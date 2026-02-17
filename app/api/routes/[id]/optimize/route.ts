import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { optimizeStops } from "@/lib/google/directions";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch current stops with coordinates
  const { data: route, error: fetchError } = await supabase
    .from("saved_routes")
    .select(`
      id,
      route_stops (
        id, stop_order,
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

  type StopRow = {
    id: string;
    stop_order: number;
    synced_contacts: { id: string; latitude: number; longitude: number } | null;
  };
  const stops = (route.route_stops as unknown as StopRow[]).filter(
    (s) => s.synced_contacts?.latitude && s.synced_contacts?.longitude
  );

  if (stops.length < 2) {
    return NextResponse.json({ error: "Need at least 2 geocoded stops to optimize" }, { status: 400 });
  }

  const latLngs = stops.map((s) => ({
    lat: s.synced_contacts!.latitude,
    lng: s.synced_contacts!.longitude,
  }));

  const result = await optimizeStops(latLngs);

  // Reorder stops: update stop_order for each stop
  const updates = result.orderedIndices.map((originalIdx, newOrder) => ({
    id: stops[originalIdx].id,
    stop_order: newOrder,
  }));

  // Upsert new orders
  for (const update of updates) {
    await supabase
      .from("route_stops")
      .update({ stop_order: update.stop_order })
      .eq("id", update.id);
  }

  // Save distance/duration to route
  await supabase
    .from("saved_routes")
    .update({
      total_distance_meters: result.totalDistanceMeters,
      total_duration_seconds: result.totalDurationSeconds,
    })
    .eq("id", id);

  return NextResponse.json({
    data: {
      orderedIndices: result.orderedIndices,
      totalDistanceMeters: result.totalDistanceMeters,
      totalDurationSeconds: result.totalDurationSeconds,
    },
  });
}
