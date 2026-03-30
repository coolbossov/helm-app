import type { ZohoContact, ZohoMultiselect } from "@/types";

/**
 * Zoho Bigin stores multiselect values with both actual_value and display_value.
 * For Business_Type, "School Picture Day" is the actual_value, "School" is the display.
 * We map to short display names for the app.
 */

const BUSINESS_TYPE_MAP: Record<string, string> = {
  // Maps Bigin actual_value → display label for the HELM app
  // Current values (post-2026-03-20 restructure)
  "School Picture Day":          "School",
  "School":                      "School",
  // School subtypes (Accounts picklist)
  "School - Public 6-8":         "School - Public 6-8",
  "School - Public 6-12":        "School - Public 6-12",
  "School - Public 9-12":        "School - Public 9-12",
  "School - Charter Elementary": "School - Charter Elementary",
  "School - Charter 6-12":       "School - Charter 6-12",
  "School - Charter K-12":       "School - Charter K-12",
  "School - Private Elementary": "School - Private Elementary",
  "School - Private 6-12":       "School - Private 6-12",
  "School - Private K-12":       "School - Private K-12",
  "Dance": "Dance",
  "Gymnastics": "Gymnastics",
  "Cheer": "Cheer",
  "Daycare Picture Day": "Daycare",
  "Daycare": "Daycare",
  "Sports": "Sports",
  "Martial Arts": "Martial Arts",
  "Performing Arts": "Performing Arts",
  "Senior Living": "Senior Living",
  "Family Photoshoot": "Family Photoshoot",
  "Mini Sessions": "Mini Sessions",
  "Headshots": "Headshots",
  "Event": "Event",
  "Photo booth": "Photo Booth",
  "Photo Booth": "Photo Booth",
  "Media Day": "Media Day",
  "Product": "Product",
  "Military": "Military",
  "Other": "Other",
  // Legacy values (pre-restructure) — kept for backwards compatibility
  "Dance Studio Picture Day": "Dance",
  "Daycare/Preschool Picture Day": "Daycare",
  "Cheer Picture Day": "Cheer",
  "Sports Picture Day": "Sports",
  // Legacy abbreviated labels (old app display values) — map to canonical
  "Family": "Family Photoshoot",
  "Mini":   "Mini Sessions",
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

export function mapBusinessType(
  value: string | ZohoMultiselect | undefined
): string | null {
  if (!value) return null;
  const raw = typeof value === "string" ? value : (value.display_value || value.actual_value);
  return BUSINESS_TYPE_MAP[raw] || raw;
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
