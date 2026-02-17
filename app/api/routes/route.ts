import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createRouteSchema = z.object({
  name: z.string().min(1).max(100),
  planned_date: z.string().nullable().optional(),
  stop_ids: z.array(z.string().uuid()).optional(), // contact IDs in order
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_routes")
    .select("*, route_stops(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createRouteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, planned_date, stop_ids } = parsed.data;

  // Create route
  const { data: route, error: routeError } = await supabase
    .from("saved_routes")
    .insert({ user_id: user.id, name, planned_date: planned_date ?? null })
    .select()
    .single();

  if (routeError) return NextResponse.json({ error: routeError.message }, { status: 500 });

  // Insert stops if provided
  if (stop_ids && stop_ids.length > 0) {
    const stops = stop_ids.map((contact_id, index) => ({
      route_id: route.id,
      contact_id,
      stop_order: index,
    }));
    const { error: stopsError } = await supabase.from("route_stops").insert(stops);
    if (stopsError) return NextResponse.json({ error: stopsError.message }, { status: 500 });
  }

  return NextResponse.json({ data: route }, { status: 201 });
}
