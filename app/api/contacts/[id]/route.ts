import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateAccount as updateBiginAccount } from "@/lib/zoho/client";

const patchSchema = z.object({
  lifecycle_stage: z.enum(["Lead", "Contacted", "Qualified", "Proposal", "Customer", "Churned"]).optional(),
  contacting_status: z.enum(["Not Contacted", "Attempted", "In Conversation", "Follow Up", "Not Interested", "Closed"]).optional(),
  priority: z.enum(["High Priority", "Medium Priority", "Low Priority", "Warm Priority", "Hot Priority"]).optional(),
  contacting_tips: z.string().max(2000).optional(),
  business_type: z.union([z.string(), z.array(z.string())]).optional(),
  // Visit tracking fields — Supabase-only, not synced to Bigin
  visit_status: z.enum([
    "Never Visited",
    "Visited Recently",
    "Needs Follow-up",
    "Hot Lead",
    "Not Interested",
    "Closed Won",
  ]).optional(),
  last_visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function normalizeCompanyAsContact(data: Record<string, unknown>) {
  return {
    ...data,
    zoho_id: data.zoho_account_id,
    last_name: data.company_name,
    first_name: null,
    account_name: data.company_name,
    email: null,
    mobile: null,
    mailing_street: data.billing_street,
    mailing_city: data.billing_city,
    mailing_state: data.billing_state,
    mailing_zip: data.billing_zip,
    mailing_country: null,
    business_type: data.business_type ? [String(data.business_type)] : [],
  };
}

async function resolveActivityContactId(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  const { data: company } = await admin
    .from("synced_companies")
    .select("company_name")
    .eq("id", companyId)
    .single();

  if (!company?.company_name) return null;

  const { data: linked } = await admin
    .from("synced_contacts")
    .select("id")
    .eq("account_name", company.company_name)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  return linked?.id ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("synced_companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === "PGRST116" ? 404 : 500 }
    );
  }

  return NextResponse.json({ data: normalizeCompanyAsContact(data as Record<string, unknown>) });
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

  if (updates.business_type !== undefined) {
    const value = updates.business_type;
    updates.business_type = Array.isArray(value) ? (value[0] ?? null) : value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Use admin client for write (RLS only allows service_role to update)
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("synced_companies")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Queue field update for Zoho sync — exclude fields that only live in Supabase
  const SUPABASE_ONLY_FIELDS = new Set(["visit_status", "last_visit_date"]);
  const biginFields = Object.fromEntries(
    Object.entries(updates).filter(([k]) => !SUPABASE_ONLY_FIELDS.has(k))
  );
  if (Object.keys(biginFields).length > 0) {
    await admin.from("field_updates").insert({
      company_id: id,
      changes: biginFields,
      status: "pending",
    });
  }

  const activityContactId = await resolveActivityContactId(admin, id);

  // Auto-log status_change activity for key field changes
  const statusFields = ["lifecycle_stage", "contacting_status", "priority", "visit_status"];
  for (const field of statusFields) {
    if (updates[field] !== undefined) {
      if (activityContactId) {
        await admin.from("contact_activities").insert({
          contact_id: activityContactId,
          user_id: user.id,
          activity_type: "status_change",
          title: `${field.replace(/_/g, " ")} changed to ${updates[field]}`,
          metadata: { field, new_value: updates[field], company_id: id },
        });
      }
    }
  }

  // Automation 6: When a visit is logged in HELM, sync Last_Meeting_Date to Bigin
  // This fires when last_visit_date is set (onsite visit recorded by the field sales team)
  if (updates.last_visit_date && data?.zoho_account_id) {
    try {
      await updateBiginAccount(data.zoho_account_id, {
        Last_Meeting_Date: updates.last_visit_date as string,
        Last_Meeting_Notes: `[HELM visit logged ${updates.last_visit_date}]`,
      });
    } catch (err) {
      // Non-fatal: log but don't fail the response — Supabase update already succeeded
      console.error("[HELM] Failed to update Bigin Last_Meeting_Date:", err);
    }
  }

  return NextResponse.json({ data: normalizeCompanyAsContact(data as Record<string, unknown>) });
}
