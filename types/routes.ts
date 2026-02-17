export type RouteStatus = "planned" | "in_progress" | "completed";
export type StopStatus = "pending" | "visited" | "skipped";

export interface SavedRoute {
  id: string;
  user_id: string;
  name: string;
  status: RouteStatus;
  total_distance_meters: number | null;
  total_duration_seconds: number | null;
  planned_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RouteStop {
  id: string;
  route_id: string;
  contact_id: string;
  stop_order: number;
  status: StopStatus;
  visit_notes: string | null;
  visited_at: string | null;
  created_at: string;
}
