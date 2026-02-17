export type RouteStatus = "planned" | "in_progress" | "completed";
export type StopStatus = "pending" | "visited" | "skipped";
export type StopPriority = "must_visit" | "nice_to_visit";
export type OptimizationMode = "fastest" | "shortest" | "strict_time_windows";

export interface SavedRoute {
  id: string;
  user_id: string;
  name: string;
  status: RouteStatus;
  total_distance_meters: number | null;
  total_duration_seconds: number | null;
  planned_date: string | null;
  optimization_mode: OptimizationMode;
  created_at: string;
  updated_at: string;
}

export interface RouteStop {
  id: string;
  route_id: string;
  contact_id: string;
  stop_order: number;
  status: StopStatus;
  priority: StopPriority;
  visit_notes: string | null;
  visited_at: string | null;
  time_window_start: string | null; // HH:MM:SS
  time_window_end: string | null;   // HH:MM:SS
  expected_duration_min: number;
  visit_outcome: string | null;
  created_at: string;
}
