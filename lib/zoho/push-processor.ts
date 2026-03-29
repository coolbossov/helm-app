import { createAdminClient } from "@/lib/supabase/admin";
import { updateContact } from "./client";

const FIELD_MAP: Record<string, string> = {
  lifecycle_stage: "Lifecycle_stage",
  contacting_status: "Contacting_Status",
  priority: "Priority",
  contacting_tips: "Contacting_Tips",
};

export interface FieldUpdateDetail {
  contactName: string;
  fields: Record<string, unknown>;
  status: "synced" | "failed";
  error?: string;
}

export interface FieldUpdateResult {
  processed: number;
  failed: number;
  details: FieldUpdateDetail[];
}

export async function processFieldUpdates(): Promise<FieldUpdateResult> {
  const admin = createAdminClient();

  const { data: pending, error } = await admin
    .from("field_updates")
    .select("id, contact_id, changes")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !pending || pending.length === 0) {
    return { processed: 0, failed: 0, details: [] };
  }

  // Fetch zoho_ids and names for all contact_ids in batch
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

  let processed = 0;
  let failed = 0;
  const details: FieldUpdateDetail[] = [];

  for (const row of pending) {
    const contact = contactMap.get(row.contact_id);
    const contactName = contact?.name ?? "Unknown";
    const changes = row.changes as Record<string, unknown>;

    if (!contact) {
      await admin
        .from("field_updates")
        .update({ status: "failed", error_message: "Contact not found in synced_contacts" })
        .eq("id", row.id);
      failed++;
      details.push({ contactName, fields: changes, status: "failed", error: "Contact not found" });
      continue;
    }

    // Reverse-map app field names → Zoho field names
    const zohoData: Record<string, unknown> = {};
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
      details.push({ contactName, fields: changes, status: "synced" });
      continue;
    }

    try {
      await updateContact(contact.zohoId, zohoData);
      await admin
        .from("field_updates")
        .update({ status: "synced", synced_at: new Date().toISOString() })
        .eq("id", row.id);
      processed++;
      details.push({ contactName, fields: changes, status: "synced" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await admin
        .from("field_updates")
        .update({ status: "failed", error_message: message })
        .eq("id", row.id);
      failed++;
      details.push({ contactName, fields: changes, status: "failed", error: message });
    }
  }

  return { processed, failed, details };
}
