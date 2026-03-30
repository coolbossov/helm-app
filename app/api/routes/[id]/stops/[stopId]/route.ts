import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const patchStopSchema = z.object({
  status: z.enum(["pending", "visited", "skipped"]).optional(),
  visit_notes: z.string().max(1000).nullable().optional(),
  stop_order: z.number().int().min(0).optional(),
  priority: z.enum(["must_visit", "nice_to_visit"]).optional(),
  time_window_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  time_window_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  expected_duration_min: z.number().int().min(1).max(480).optional(),
  visit_outcome: z.string().max(100).nullable().optional(),
});

type Params = { params: Promise<{ id: string; stopId: string }> };

type LinkedContactResolution = {
  contactId: string | null;
  reason: "resolved" | "no_company_name" | "not_found" | "ambiguous";
};

async function resolveLinkedContactId(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  const { data: company } = await admin
    .from("synced_companies")
    .select("company_name")
    .eq("id", companyId)
    .single();

  if (!company?.company_name) {
    return { contactId: null, reason: "no_company_name" } satisfies LinkedContactResolution;
  }

  const { data: linkedContacts } = await admin
    .from("synced_contacts")
    .select("id")
    .eq("account_name", company.company_name);

  if (!linkedContacts || linkedContacts.length === 0) {
    return { contactId: null, reason: "not_found" } satisfies LinkedContactResolution;
  }

  if (linkedContacts.length > 1) {
    return { contactId: null, reason: "ambiguous" } satisfies LinkedContactResolution;
  }

  return {
    contactId: linkedContacts[0]?.id ?? null,
    reason: "resolved",
  } satisfies LinkedContactResolution;
}

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
  let visitActivityMeta: Record<string, unknown> | null = null;
  if (parsed.data.status === "visited") {
    const admin = createAdminClient();
    let targetContactId: string | null = data?.contact_id ?? null;
    const metadata: Record<string, unknown> = { route_id: id, stop_id: stopId };

    if (!targetContactId && data?.company_id) {
      const linkedResolution = await resolveLinkedContactId(admin, data.company_id);
      targetContactId = linkedResolution.contactId;
      if (linkedResolution.reason === "ambiguous") {
        visitActivityMeta = {
          status: "skipped",
          reason: "ambiguous_company_contact",
          company_id: data.company_id,
        };
      }

      if (targetContactId) {
        metadata.company_id = data.company_id;
      }
    }

    if (targetContactId) {
      const { error: activityInsertError } = await admin.from("contact_activities").insert({
        contact_id: targetContactId,
        user_id: user.id,
        activity_type: "visit",
        title: "Visited",
        content: parsed.data.visit_notes ?? null,
        metadata,
      });

      visitActivityMeta = activityInsertError
        ? { status: "error", reason: activityInsertError.message }
        : { status: "logged" };
    }
  }

  return NextResponse.json({ data, meta: visitActivityMeta ? { visit_activity: visitActivityMeta } : null });
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
