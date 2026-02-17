export type ActivityType = "visit" | "call" | "note" | "status_change" | "field_change";

export interface ContactActivity {
  id: string;
  contact_id: string;
  user_id: string;
  activity_type: ActivityType;
  title: string | null;
  content: string | null;
  metadata: Record<string, unknown>;
  bigin_synced: boolean;
  bigin_synced_at: string | null;
  created_at: string;
}

export interface CreateActivityInput {
  activity_type: ActivityType;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}
