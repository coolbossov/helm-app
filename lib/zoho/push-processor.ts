import { createAdminClient } from "@/lib/supabase/admin";
import { updateContact } from "./client";

const FIELD_MAP: Record<string, string> = {
  lifecycle_stage: "Lifecycle_stage",
  contacting_status: "Contacting_Status",
  priority: "Priority",
  contacting_tips: "Contacting_Tips",
};

export async function processFieldUpdates(): Promise<{ processed: number; failed: number }> {
  const admin = createAdminClient();

  const { data: pending, error } = await admin
    .from("field_updates")
    .select("id, contact_id, changes")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !pending || pending.length === 0) {
    return { processed: 0, failed: 0 };
  }

  // Fetch zoho_ids for all contact_ids in batch
  const contactIds = [...new Set(pending.map((r) => r.contact_id))];
  const { data: contacts } = await admin
    .from("synced_contacts")
    .select("id, zoho_id")
    .in("id", contactIds);

  const zohoIdMap = new Map<string, string>(
    (contacts ?? []).map((c) => [c.id, c.zoho_id])
  );

  let processed = 0;
  let failed = 0;

  for (const row of pending) {
    const zohoId = zohoIdMap.get(row.contact_id);
    if (!zohoId) {
      await admin
        .from("field_updates")
        .update({ status: "failed", error_message: "Contact not found in synced_contacts" })
        .eq("id", row.id);
      failed++;
      continue;
    }

    // Reverse-map app field names → Zoho field names
    const zohoData: Record<string, unknown> = {};
    const changes = row.changes as Record<string, unknown>;
    for (const [appField, value] of Object.entries(changes)) {
      const zohoField = FIELD_MAP[appField];
      if (zohoField) {
        zohoData[zohoField] = value;
      }
    }

    if (Object.keys(zohoData).length === 0) {
      await admin
        .from("field_updates")
        .update({ status: "synced", synced_at: new Date().toISOString() })
        .eq("id", row.id);
      processed++;
      continue;
    }

    try {
      await updateContact(zohoId, zohoData);
      await admin
        .from("field_updates")
        .update({ status: "synced", synced_at: new Date().toISOString() })
        .eq("id", row.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await admin
        .from("field_updates")
        .update({ status: "failed", error_message: message })
        .eq("id", row.id);
      failed++;
    }
  }

  return { processed, failed };
}
