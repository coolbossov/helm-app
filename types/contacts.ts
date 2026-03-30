export type BusinessType =
  | "School"
  | "School - Public 6-8"
  | "School - Public 6-12"
  | "School - Public 9-12"
  | "School - Charter Elementary"
  | "School - Charter 6-12"
  | "School - Charter K-12"
  | "School - Private Elementary"
  | "School - Private 6-12"
  | "School - Private K-12"
  | "Dance"
  | "Gymnastics"
  | "Daycare"
  | "Cheer"
  | "Sports"
  | "Martial Arts"
  | "Performing Arts"
  | "Senior Living"
  | "Family Photoshoot"
  | "Mini Sessions"
  | "Headshots"
  | "Event"
  | "Photo Booth"
  | "Media Day"
  | "Product"
  | "Military"
  | "Other";

export type Priority =
  | "High Priority"
  | "Medium Priority"
  | "Low Priority"
  | "Warm Priority"
  | "Hot Priority";

export type LifecycleStage =
  | "Lead"
  | "Contacted"
  | "Qualified"
  | "Proposal"
  | "Customer"
  | "Churned";

export type ContactingStatus =
  | "Not Contacted"
  | "Attempted"
  | "In Conversation"
  | "Follow Up"
  | "Not Interested"
  | "Closed";

export type GeocodeStatus = "pending" | "success" | "failed" | "no_address";

export type VisitStatus =
  | "Never Visited"
  | "Visited Recently"
  | "Needs Follow-up"
  | "Hot Lead"
  | "Not Interested"
  | "Closed Won";

export interface SyncedContact {
  id: string;
  zoho_id: string;
  last_name: string;
  first_name: string | null;
  account_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;

  mailing_street: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  mailing_country: string | null;

  latitude: number | null;
  longitude: number | null;
  geocode_status: GeocodeStatus;

  business_type: string[];
  priority: Priority | null;
  lifecycle_stage: LifecycleStage | null;
  contacting_status: ContactingStatus | null;

  visit_status: VisitStatus | null;
  last_visit_date: string | null; // ISO date string YYYY-MM-DD

  contacting_tips: string | null;
  prospecting_notes: string | null;

  zoho_created_time: string | null;
  zoho_modified_time: string | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface ContactMarkerData {
  id: string;
  zoho_id: string;
  last_name: string;
  account_name: string | null;
  latitude: number;
  longitude: number;
  business_type: string[];
  priority: Priority | null;
  lifecycle_stage: LifecycleStage | null;
  contacting_status: ContactingStatus | null;
  visit_status: VisitStatus | null;
  last_visit_date: string | null;
}

export interface ContactFilters {
  business_types: string[];
  priorities: Priority[];
  lifecycle_stages: LifecycleStage[];
  contacting_statuses: ContactingStatus[];
  visit_statuses: VisitStatus[];
  overdue_days: number | null; // filter: not visited in X days
  search: string;
}

export const DEFAULT_FILTERS: ContactFilters = {
  business_types: [],
  priorities: [],
  lifecycle_stages: [],
  contacting_statuses: [],
  visit_statuses: [],
  overdue_days: null,
  search: "",
};

export const BUSINESS_TYPE_COLORS: Record<string, string> = {
  // Schools — blue family
  "School":                      "#3b82f6",
  "School - Public 6-8":         "#2563eb",
  "School - Public 6-12":        "#1d4ed8",
  "School - Public 9-12":        "#1e40af",
  "School - Charter Elementary": "#0284c7",
  "School - Charter 6-12":       "#0369a1",
  "School - Charter K-12":       "#075985",
  "School - Private Elementary": "#7c3aed",
  "School - Private 6-12":       "#6d28d9",
  "School - Private K-12":       "#5b21b6",
  // Activity-based
  "Dance":           "#ec4899",
  "Gymnastics":      "#f59e0b",
  "Daycare":         "#22c55e",
  "Cheer":           "#a855f7",
  "Sports":          "#f97316",
  "Martial Arts":    "#ef4444",
  "Performing Arts": "#d946ef",
  "Senior Living":   "#14b8a6",
  // Photography sessions
  "Family Photoshoot": "#f472b6",
  "Mini Sessions":     "#fb923c",
  "Headshots":         "#64748b",
  "Event":             "#8b5cf6",
  "Photo Booth":       "#06b6d4",
  "Media Day":         "#10b981",
  "Product":           "#6366f1",
  // Other
  "Military": "#78716c",
  "Other":    "#6b7280",
};

/** Pin fill color by visit status (used when map is in "visit mode") */
export const VISIT_STATUS_COLORS: Record<VisitStatus, string> = {
  "Never Visited":    "#6b7280", // gray
  "Visited Recently": "#22c55e", // green
  "Needs Follow-up":  "#eab308", // yellow
  "Hot Lead":         "#3b82f6", // blue
  "Not Interested":   "#ef4444", // red
  "Closed Won":       "#a855f7", // purple
};

/** Ring/border color derived from recency (days since last visit) */
export function getVisitRecencyColor(lastVisitDate: string | null): string {
  if (!lastVisitDate) return "#ef4444"; // red — never visited
  const days = (Date.now() - new Date(lastVisitDate).getTime()) / 86400000;
  if (days <= 30) return "#22c55e";  // green — recent
  if (days <= 90) return "#eab308";  // yellow — follow-up needed
  return "#ef4444";                   // red — overdue
}
