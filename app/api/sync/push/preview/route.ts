import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface ContactRef {
  first_name: string | null;
  last_name: string;
}

function formatName(contact: ContactRef | null): string {
  if (!contact) return "Unknown";
  return contact.first_name
    ? `${contact.first_name} ${contact.last_name}`
    : contact.last_name;
}

export async function GET() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch pending field updates with contact names
  const { data: fieldUpdates } = await admin
    .from("field_updates")
    .select("id, changes, contact:synced_contacts!contact_id(first_name, last_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  // Fetch pending activity notes with contact names
  const { data: activities } = await admin
    .from("contact_activities")
    .select(
      "id, activity_type, title, content, contact:synced_contacts!contact_id(first_name, last_name)",
    )
    .eq("bigin_synced", false)
    .order("created_at", { ascending: true })
    .limit(50);

  const mappedFieldUpdates = (fieldUpdates ?? []).map((fu) => ({
    id: fu.id,
    contact_name: formatName(fu.contact as unknown as ContactRef),
    fields: fu.changes as Record<string, unknown>,
  }));

  const mappedActivities = (activities ?? []).map((a) => ({
    id: a.id,
    contact_name: formatName(a.contact as unknown as ContactRef),
    type: a.activity_type,
    title: a.title,
  }));

  return NextResponse.json({
    field_updates: mappedFieldUpdates,
    activities: mappedActivities,
    total_field_updates: mappedFieldUpdates.length,
    total_activities: mappedActivities.length,
  });
}
