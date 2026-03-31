import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("contact_activities")
    .select(`
      id,
      created_at,
      activity_type,
      title,
      metadata,
      synced_contacts ( last_name, account_name )
    `)
    .eq("user_id", user.id)
    .eq("activity_type", "visit")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Shape response: pull company_name from metadata if available, else fall back to contact name
  const entries = (data ?? []).map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    // Supabase returns FK joins as a single object (not array) when the relation is many-to-one
    const raw = row.synced_contacts;
    const contact = (Array.isArray(raw) ? raw[0] : raw) as { last_name: string; account_name: string | null } | null | undefined;
    return {
      id: row.id,
      created_at: row.created_at,
      name: contact?.account_name ?? contact?.last_name ?? "Unknown",
      route_id: meta.route_id as string | undefined,
      stop_id: meta.stop_id as string | undefined,
    };
  });

  return NextResponse.json({ data: entries });
}
