import type { ZohoContact, ZohoMultiselect } from "@/types";

/**
 * Zoho Bigin stores multiselect values with both actual_value and display_value.
 * For Business_Type, "School Picture Day" is the actual_value, "School" is the display.
 * We map to short display names for the app.
 */

const BUSINESS_TYPE_MAP: Record<string, string> = {
  // Maps Bigin actual_value → short display label for the HELM app
  // Current values (post-2026-03-20 restructure)
  "School Picture Day": "School",
  "Dance": "Dance",
  "Gymnastics": "Gymnastics",
  "Cheer": "Cheer",
  "Daycare Picture Day": "Daycare",
  "Sports": "Sports",
  "Martial Arts": "Martial Arts",
  "Performing Arts": "Performing Arts",
  "Senior Living": "Senior Living",
  "Family Photoshoot": "Family",
  "Mini Sessions": "Mini",
  "Headshots": "Headshots",
  "Event": "Event",
  "Photo booth": "Photo Booth",
  "Media Day": "Media Day",
  "Product": "Product",
  "Other": "Other",
  // Legacy values (pre-restructure) — kept for backwards compatibility
  "Dance Studio Picture Day": "Dance",
  "Daycare/Preschool Picture Day": "Daycare",
  "Cheer Picture Day": "Cheer",
  "Sports Picture Day": "Sports",
};

const LIFECYCLE_STAGE_MAP: Record<string, string> = {
  // Current canonical values (post-2026-03-20 restructure)
  "New": "New",
  "Contacted": "Contacted",
  "Engaged": "Engaged",
  "Qualified": "Qualified",
  "Customer": "Customer",
  "Churned": "Churned",
  "Do Not Contact": "Do Not Contact",
  // Legacy values (pre-restructure) — kept for backwards compatibility
  "New Prospect": "New",
  "Lead Enriched": "Contacted",
  "Enriched": "Contacted",
  "Lead": "Contacted",
  "Warm Lead": "Engaged",
  "Prospect": "New",
  "Lead-Not Yet Contacted": "New",
  "Lead-Contacted": "Contacted",
  "Lead-Qualified": "Qualified",
  "Proposal/Quote Sent": "Qualified",
  "Active Customer": "Customer",
  "Churned/Lost": "Churned",
};

export function mapBusinessTypes(
  types: ZohoMultiselect[] | string[] | undefined
): string[] {
  if (!types || !Array.isArray(types)) return [];
  return types.map((t) => {
    const raw = typeof t === "string" ? t : (t.display_value || t.actual_value);
    return BUSINESS_TYPE_MAP[raw] || raw;
  });
}

export function mapLifecycleStage(value: string | undefined): string | null {
  if (!value) return null;
  return LIFECYCLE_STAGE_MAP[value] || value;
}

export function mapPriority(value: string | undefined): string | null {
  if (!value) return null;
  // Zoho stores as "High Priority", "Medium Priority", "Low Priority"
  return value;
}

export function mapContactingStatus(value: string | undefined): string | null {
  if (!value) return null;
  return value;
}

export function extractAccountName(
  contact: ZohoContact
): string | null {
  if (contact.Account_Name) {
    return typeof contact.Account_Name === "object"
      ? contact.Account_Name.name
      : String(contact.Account_Name);
  }
  return null;
}
