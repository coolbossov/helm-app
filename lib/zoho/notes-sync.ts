import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessToken } from "./token";

const BIGIN_API_BASE = "https://www.zohoapis.com/bigin/v2";

async function postNote(zohoId: string, title: string, content: string): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(`${BIGIN_API_BASE}/Contacts/${zohoId}/Notes`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: [{ Note_Title: title, Note_Content: content }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zoho Notes API ${response.status}: ${text}`);
  }
}

export async function processPendingActivitySync(): Promise<{ synced: number; failed: number }> {
  const admin = createAdminClient();

  const { data: pending, error } = await admin
    .from("contact_activities")
    .select("id, contact_id, activity_type, title, content")
    .eq("bigin_synced", false)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !pending || pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const contactIds = [...new Set(pending.map((r) => r.contact_id))];
  const { data: contacts } = await admin
    .from("synced_contacts")
    .select("id, zoho_id")
    .in("id", contactIds);

  const zohoIdMap = new Map<string, string>(
    (contacts ?? []).map((c) => [c.id, c.zoho_id])
  );

  let synced = 0;
  let failed = 0;

  for (const activity of pending) {
    const zohoId = zohoIdMap.get(activity.contact_id);
    if (!zohoId) {
      await admin
        .from("contact_activities")
        .update({ bigin_synced: true, bigin_synced_at: new Date().toISOString() })
        .eq("id", activity.id);
      synced++;
      continue;
    }

    const noteTitle = activity.title || `${activity.activity_type} logged`;
    const noteContent = activity.content || noteTitle;

    try {
      await postNote(zohoId, noteTitle, noteContent);
      await admin
        .from("contact_activities")
        .update({ bigin_synced: true, bigin_synced_at: new Date().toISOString() })
        .eq("id", activity.id);
      synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to sync activity ${activity.id}:`, message);
      failed++;
    }
  }

  return { synced, failed };
}
