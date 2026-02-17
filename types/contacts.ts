export type BusinessType =
  | "Dance"
  | "School"
  | "Daycare"
  | "Cheer"
  | "Sports"
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
}

export interface ContactFilters {
  business_types: string[];
  priorities: Priority[];
  lifecycle_stages: LifecycleStage[];
  contacting_statuses: ContactingStatus[];
  search: string;
}

export const DEFAULT_FILTERS: ContactFilters = {
  business_types: [],
  priorities: [],
  lifecycle_stages: [],
  contacting_statuses: [],
  search: "",
};

export const BUSINESS_TYPE_COLORS: Record<string, string> = {
  Dance: "#ec4899",
  School: "#3b82f6",
  Daycare: "#22c55e",
  Cheer: "#a855f7",
  Sports: "#f97316",
  Other: "#6b7280",
};
