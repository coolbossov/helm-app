import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllContacts } from "./client";
import {
  mapBusinessTypes,
  mapLifecycleStage,
  mapPriority,
  mapContactingStatus,
  extractAccountName,
} from "./field-mappings";
import type { ZohoContact } from "@/types";

export interface ContactChangeDetail {
  name: string;
  type: "created" | "updated" | "unchanged";
  fieldsChanged?: string[];
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  unchanged: number;
  details: ContactChangeDetail[];
}

/** Fields to compare when diffing incoming vs existing contacts */
const DIFF_FIELDS = [
  "first_name",
  "last_name",
  "account_name",
  "email",
  "phone",
  "mobile",
  "website",
  "mailing_street",
  "mailing_city",
  "mailing_state",
  "mailing_zip",
  "mailing_country",
  "business_type",
  "priority",
  "lifecycle_stage",
  "contacting_status",
  "contacting_tips",
  "prospecting_notes",
] as const;

/** Select clause for fetching existing contacts for diff comparison */
const EXISTING_SELECT = ["zoho_id", ...DIFF_FIELDS].join(", ");

function diffContact(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>,
): string[] {
  const changed: string[] = [];
  for (const field of DIFF_FIELDS) {
    const a = incoming[field];
    const b = existing[field];
    // Handle arrays (business_type) with JSON comparison
    if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a ?? []) !== JSON.stringify(b ?? [])) {
        changed.push(field);
      }
    } else if (String(a ?? "") !== String(b ?? "")) {
      changed.push(field);
    }
  }
  return changed;
}

function formatContactName(row: { first_name?: string | null; last_name: string }): string {
  return row.first_name ? `${row.first_name} ${row.last_name}` : row.last_name;
}

function contactToRow(contact: ZohoContact) {
  return {
    zoho_id: contact.id,
    last_name: contact.Last_Name,
    first_name: contact.First_Name || null,
    account_name: extractAccountName(contact),
    email: contact.Email || null,
    phone: contact.Phone || null,
    mobile: contact.Mobile || null,
    website: contact.Website || null,
    mailing_street: contact.Mailing_Street || null,
    mailing_city: contact.Mailing_City || null,
    mailing_state: contact.Mailing_State || null,
    mailing_zip: contact.Mailing_Zip || null,
    mailing_country: contact.Mailing_Country || null,
    business_type: mapBusinessTypes(contact.Business_Type),
    priority: mapPriority(contact.Priority),
    lifecycle_stage: mapLifecycleStage(contact.Lifecycle_stage),
    contacting_status: mapContactingStatus(contact.Contacting_Status),
    contacting_tips: contact.Contacting_Tips || null,
    prospecting_notes: contact.Prospecting_Initial_notes || null,
    zoho_created_time: contact.Created_Time || null,
    zoho_modified_time: contact.Modified_Time || null,
    last_synced_at: new Date().toISOString(),
  };
}

export async function syncAllContacts(): Promise<SyncResult> {
  const supabase = createAdminClient();
  const contacts = await fetchAllContacts();

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const details: ContactChangeDetail[] = [];

  // Process in batches of 50
  for (let i = 0; i < contacts.length; i += 50) {
    const batch = contacts.slice(i, i + 50);
    const rows = batch.map(contactToRow);
    const zohoIds = batch.map((contact) => contact.id);

    // Fetch existing contacts with all comparable fields for diff
    const { data: existingContacts, error: existingError } = await supabase
      .from("synced_contacts")
      .select(EXISTING_SELECT)
      .in("zoho_id", zohoIds)
      .returns<Array<Record<string, unknown>>>();

    if (existingError) {
      console.error("Select existing batch error:", existingError);
      throw new Error(`Failed to check existing contacts: ${existingError.message}`);
    }

    // Build lookup by zoho_id for diff comparison
    const existingMap = new Map<string, Record<string, unknown>>(
      (existingContacts ?? []).map((row) => [String(row.zoho_id), row]),
    );

    // Diff each contact and collect details
    for (let j = 0; j < batch.length; j++) {
      const row = rows[j];
      const existing = existingMap.get(row.zoho_id);
      const name = formatContactName(row);

      if (!existing) {
        created++;
        details.push({ name, type: "created" });
      } else {
        const fieldsChanged = diffContact(row, existing);
        if (fieldsChanged.length > 0) {
          updated++;
          details.push({ name, type: "updated", fieldsChanged });
        } else {
          unchanged++;
          details.push({ name, type: "unchanged" });
        }
      }
    }

    // visit_status and last_visit_date are NOT in contactToRow() — they're app-managed
    // and will not be overwritten by Bigin syncs
    const { error } = await supabase
      .from("synced_contacts")
      .upsert(rows, { onConflict: "zoho_id" });

    if (error) {
      console.error("Upsert batch error:", error);
      throw new Error(`Failed to upsert contacts: ${error.message}`);
    }
  }

  // Mark contacts without any address as no_address
  await supabase
    .from("synced_contacts")
    .update({ geocode_status: "no_address" })
    .is("mailing_street", null)
    .is("mailing_city", null)
    .eq("geocode_status", "pending");

  return {
    synced: contacts.length,
    created,
    updated,
    unchanged,
    details,
  };
}

export function getFullAddress(contact: {
  mailing_street: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
}): string | null {
  const parts = [
    contact.mailing_street,
    contact.mailing_city,
    contact.mailing_state,
    contact.mailing_zip,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}
