import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  activity_type: z.enum(["visit", "call", "note", "status_change", "field_change"]),
  title: z.string().max(500).optional(),
  content: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type Params = { params: Promise<{ id: string }> };

async function resolveCompanyContactIds(id: string) {
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("synced_companies")
    .select("company_name")
    .eq("id", id)
    .single();

  if (!company?.company_name) return [] as string[];

  const ids: string[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data: linkedContacts, error } = await supabase
      .from("synced_contacts")
      .select("id")
      .eq("account_name", company.company_name)
      .range(from, to);

    if (error || !linkedContacts?.length) break;

    ids.push(...linkedContacts.map((c) => c.id));

    if (linkedContacts.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = 20;
  const from = (page - 1) * limit;

  let query = supabase
    .from("contact_activities")
    .select("*", { count: "exact" })
    .eq("contact_id", id)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  let { data, error, count } = await query;

  if (error?.code === "PGRST116" || ((data?.length ?? 0) === 0 && !error)) {
    const linkedIds = await resolveCompanyContactIds(id);
    if (linkedIds.length > 0) {
      query = supabase
        .from("contact_activities")
        .select("*", { count: "exact" })
        .in("contact_id", linkedIds)
        .order("created_at", { ascending: false })
        .range(from, from + limit - 1);
      ({ data, error, count } = await query);
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, limit });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  let { data, error } = await admin
    .from("contact_activities")
    .insert({
      contact_id: id,
      user_id: user.id,
      activity_type: parsed.data.activity_type,
      title: parsed.data.title ?? null,
      content: parsed.data.content ?? null,
      metadata: parsed.data.metadata ?? {},
    })
    .select()
    .single();

  if (error?.code === "23503") {
    const linkedIds = await resolveCompanyContactIds(id);
    const targetContactId = linkedIds[0];
    if (!targetContactId) {
      return NextResponse.json({ error: "No linked contact found for this company" }, { status: 400 });
    }

    ({ data, error } = await admin
      .from("contact_activities")
      .insert({
        contact_id: targetContactId,
        user_id: user.id,
        activity_type: parsed.data.activity_type,
        title: parsed.data.title ?? null,
        content: parsed.data.content ?? null,
        metadata: { ...(parsed.data.metadata ?? {}), company_id: id },
      })
      .select()
      .single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
