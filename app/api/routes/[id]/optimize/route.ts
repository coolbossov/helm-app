import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { optimizeStops } from "@/lib/google/directions";
import type { OptimizationMode } from "@/types/routes";

type Params = { params: Promise<{ id: string }> };

type StopRow = {
  id: string;
  stop_order: number;
  time_window_start: string | null;
  time_window_end: string | null;
  priority: string;
  synced_contacts: { id: string; latitude: number; longitude: number } | null;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse optional mode from request body
  let mode: OptimizationMode = "fastest";
  try {
    const body = await request.json();
    if (body?.mode && ["fastest", "shortest", "strict_time_windows"].includes(body.mode)) {
      mode = body.mode as OptimizationMode;
    }
  } catch {
    // No body or invalid JSON — use default mode
  }

  // Fetch current stops with coordinates and time windows
  const { data: route, error: fetchError } = await supabase
    .from("saved_routes")
    .select(`
      id,
      route_stops (
        id, stop_order, time_window_start, time_window_end, priority,
        synced_contacts (id, latitude, longitude)
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .order("stop_order", { referencedTable: "route_stops", ascending: true })
    .single();

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message },
      { status: fetchError.code === "PGRST116" ? 404 : 500 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawStops: StopRow[] = ((route as any).route_stops as StopRow[]).filter(
    (s: StopRow) => s.synced_contacts?.latitude && s.synced_contacts?.longitude
  );

  if (rawStops.length < 2) {
    return NextResponse.json({ error: "Need at least 2 geocoded stops to optimize" }, { status: 400 });
  }

  // For strict_time_windows: sort must_visit first, then by time window start
  if (mode === "strict_time_windows") {
    const ordered = sortByTimeWindows(rawStops);
    for (let i = 0; i < ordered.length; i++) {
      await supabase
        .from("route_stops")
        .update({ stop_order: i })
        .eq("id", ordered[i].id);
    }
    await supabase
      .from("saved_routes")
      .update({ optimization_mode: mode })
      .eq("id", id);
    return NextResponse.json({
      data: {
        orderedIndices: ordered.map((_, i) => i),
        totalDistanceMeters: null,
        totalDurationSeconds: null,
        mode,
      },
    });
  }

  const latLngs = rawStops.map((s) => ({
    lat: s.synced_contacts!.latitude,
    lng: s.synced_contacts!.longitude,
  }));

  const result = await optimizeStops(latLngs, mode);

  for (const [newOrder, originalIdx] of result.orderedIndices.entries()) {
    await supabase
      .from("route_stops")
      .update({ stop_order: newOrder })
      .eq("id", rawStops[originalIdx].id);
  }

  await supabase
    .from("saved_routes")
    .update({
      total_distance_meters: result.totalDistanceMeters,
      total_duration_seconds: result.totalDurationSeconds,
      optimization_mode: mode,
    })
    .eq("id", id);

  return NextResponse.json({
    data: {
      orderedIndices: result.orderedIndices,
      totalDistanceMeters: result.totalDistanceMeters,
      totalDurationSeconds: result.totalDurationSeconds,
      mode,
    },
  });
}

function sortByTimeWindows(stops: StopRow[]): StopRow[] {
  return [...stops].sort((a, b) => {
    if (a.priority === "must_visit" && b.priority !== "must_visit") return -1;
    if (b.priority === "must_visit" && a.priority !== "must_visit") return 1;
    if (!a.time_window_start && !b.time_window_start) return 0;
    if (!a.time_window_start) return 1;
    if (!b.time_window_start) return -1;
    return a.time_window_start.localeCompare(b.time_window_start);
  });
}
