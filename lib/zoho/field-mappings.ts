import type { ZohoContact, ZohoMultiselect } from "@/types";

/**
 * Zoho Bigin stores multiselect values with both actual_value and display_value.
 * For Business_Type, "School Picture Day" is the actual_value, "School" is the display.
 * We map to short display names for the app.
 */

const BUSINESS_TYPE_MAP: Record<string, string> = {
  "School Picture Day": "School",
  "Dance Studio Picture Day": "Dance",
  "Daycare/Preschool Picture Day": "Daycare",
  "Cheer Picture Day": "Cheer",
  "Sports Picture Day": "Sports",
  // Fallback: if display_value already short, use it directly
};

const LIFECYCLE_STAGE_MAP: Record<string, string> = {
  // Common Bigin values
  "New Prospect": "Lead",
  "Enriched": "Lead",
  "Lead-Not Yet Contacted": "Lead",
  "Lead-Contacted": "Contacted",
  "Lead-Qualified": "Qualified",
  "Proposal/Quote Sent": "Proposal",
  "Active Customer": "Customer",
  "Churned/Lost": "Churned",
  // Pass through values that already match
  "Lead": "Lead",
  "Contacted": "Contacted",
  "Qualified": "Qualified",
  "Proposal": "Proposal",
  "Customer": "Customer",
  "Churned": "Churned",
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
