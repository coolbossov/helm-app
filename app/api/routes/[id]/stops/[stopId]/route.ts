import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const patchStopSchema = z.object({
  status: z.enum(["pending", "visited", "skipped"]).optional(),
  visit_notes: z.string().max(1000).nullable().optional(),
  stop_order: z.number().int().min(0).optional(),
});

type Params = { params: Promise<{ id: string; stopId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id, stopId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify user owns the route
  const { data: route } = await supabase
    .from("saved_routes")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchStopSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "visited") {
    updates.visited_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("route_stops")
    .update(updates)
    .eq("id", stopId)
    .eq("route_id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === "PGRST116" ? 404 : 500 }
    );
  }

  // Auto-log visit activity when stop is marked visited
  if (parsed.data.status === "visited" && data?.contact_id) {
    const admin = createAdminClient();
    await admin.from("contact_activities").insert({
      contact_id: data.contact_id,
      user_id: user.id,
      activity_type: "visit",
      title: "Visited",
      content: parsed.data.visit_notes ?? null,
      metadata: { route_id: id, stop_id: stopId },
    });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id, stopId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: route } = await supabase
    .from("saved_routes")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  const { error } = await supabase
    .from("route_stops")
    .delete()
    .eq("id", stopId)
    .eq("route_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
