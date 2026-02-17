import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  lifecycle_stage: z.enum(["Lead", "Contacted", "Qualified", "Proposal", "Customer", "Churned"]).optional(),
  contacting_status: z.enum(["Not Contacted", "Attempted", "In Conversation", "Follow Up", "Not Interested", "Closed"]).optional(),
  priority: z.enum(["High Priority", "Medium Priority", "Low Priority", "Warm Priority", "Hot Priority"]).optional(),
  contacting_tips: z.string().max(2000).optional(),
  business_type: z.array(z.enum(["Dance", "School", "Daycare", "Cheer", "Sports", "Other"])).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("synced_contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === "PGRST116" ? 404 : 500 }
    );
  }

  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify user is authenticated before allowing writes
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate and sanitize with Zod
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Build update object from only the provided fields
  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  ) as Record<string, unknown>;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Use admin client for write (RLS only allows service_role to update)
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("synced_contacts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Queue field update for Zoho sync (exclude HELM-only fields)
  const { business_type: _bt, ...biginFields } = updates as Record<string, unknown> & { business_type?: unknown };
  if (Object.keys(biginFields).length > 0) {
    await admin.from("field_updates").insert({
      contact_id: id,
      changes: biginFields,
      status: "pending",
    });
  }

  // Auto-log status_change activity for key field changes
  const statusFields = ["lifecycle_stage", "contacting_status", "priority"];
  for (const field of statusFields) {
    if (updates[field] !== undefined) {
      await admin.from("contact_activities").insert({
        contact_id: id,
        user_id: user.id,
        activity_type: "status_change",
        title: `${field.replace(/_/g, " ")} changed to ${updates[field]}`,
        metadata: { field, new_value: updates[field] },
      });
    }
  }

  return NextResponse.json({ data });
}
