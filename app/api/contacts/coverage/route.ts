import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("synced_companies")
    .select("id, last_visit_date")
    .not("last_visit_date", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const normalized = (data ?? []).map((row) => ({
    contact_id: row.id,
    last_visited_at: row.last_visit_date,
  }));

  return NextResponse.json({ data: normalized });
}
