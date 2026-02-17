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

function buildAddress(contact: ZohoContact): string | null {
  const parts = [
    contact.Mailing_Street,
    contact.Mailing_City,
    contact.Mailing_State,
    contact.Mailing_Zip,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
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

export async function syncAllContacts(): Promise<{
  synced: number;
  created: number;
  updated: number;
}> {
  const supabase = createAdminClient();
  const contacts = await fetchAllContacts();

  let created = 0;
  let updated = 0;

  // Process in batches of 50
  for (let i = 0; i < contacts.length; i += 50) {
    const batch = contacts.slice(i, i + 50);
    const rows = batch.map(contactToRow);

    const { data, error } = await supabase
      .from("synced_contacts")
      .upsert(rows, { onConflict: "zoho_id" })
      .select("zoho_id");

    if (error) {
      console.error("Upsert batch error:", error);
      throw new Error(`Failed to upsert contacts: ${error.message}`);
    }

    // Count new vs updated (approximate — all upserts counted)
    if (data) {
      updated += data.length;
    }
  }

  // Get contacts that need geocoding
  const { data: needsGeocode } = await supabase
    .from("synced_contacts")
    .select("id")
    .eq("geocode_status", "pending")
    .not("mailing_street", "is", null)
    .limit(1);

  const hasUngeocodedContacts = (needsGeocode?.length ?? 0) > 0;

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
    updated: contacts.length,
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
