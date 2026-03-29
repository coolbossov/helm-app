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

export interface ActivitySyncDetail {
  contactName: string;
  type: string;
  title: string;
  status: "synced" | "failed";
  error?: string;
}

export interface ActivitySyncResult {
  synced: number;
  failed: number;
  details: ActivitySyncDetail[];
}

export async function processPendingActivitySync(): Promise<ActivitySyncResult> {
  const admin = createAdminClient();

  const { data: pending, error } = await admin
    .from("contact_activities")
    .select("id, contact_id, activity_type, title, content")
    .eq("bigin_synced", false)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !pending || pending.length === 0) {
    return { synced: 0, failed: 0, details: [] };
  }

  const contactIds = [...new Set(pending.map((r) => r.contact_id))];
  const { data: contacts } = await admin
    .from("synced_contacts")
    .select("id, zoho_id, first_name, last_name")
    .in("id", contactIds);

  const contactMap = new Map<string, { zohoId: string; name: string }>(
    (contacts ?? []).map((c) => [
      c.id,
      {
        zohoId: c.zoho_id,
        name: c.first_name ? `${c.first_name} ${c.last_name}` : c.last_name,
      },
    ]),
  );

  let synced = 0;
  let failed = 0;
  const details: ActivitySyncDetail[] = [];

  for (const activity of pending) {
    const contact = contactMap.get(activity.contact_id);
    const contactName = contact?.name ?? "Unknown";
    const noteTitle = activity.title || `${activity.activity_type} logged`;
    const noteContent = activity.content || noteTitle;

    if (!contact) {
      await admin
        .from("contact_activities")
        .update({ bigin_synced: true, bigin_synced_at: new Date().toISOString() })
        .eq("id", activity.id);
      synced++;
      details.push({ contactName, type: activity.activity_type, title: noteTitle, status: "synced" });
      continue;
    }

    try {
      await postNote(contact.zohoId, noteTitle, noteContent);
      await admin
        .from("contact_activities")
        .update({ bigin_synced: true, bigin_synced_at: new Date().toISOString() })
        .eq("id", activity.id);
      synced++;
      details.push({ contactName, type: activity.activity_type, title: noteTitle, status: "synced" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to sync activity ${activity.id}:`, message);
      failed++;
      details.push({ contactName, type: activity.activity_type, title: noteTitle, status: "failed", error: message });
    }
  }

  return { synced, failed, details };
}
