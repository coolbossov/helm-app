-- Migration: 011_route_enhancements.sql
-- Adds time windows, priority, expected duration, optimization mode, and visit outcome

-- Add time windows, priority, and expected duration to route_stops
ALTER TABLE route_stops
  ADD COLUMN IF NOT EXISTS time_window_start TIME,
  ADD COLUMN IF NOT EXISTS time_window_end TIME,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'nice_to_visit'
    CHECK (priority IN ('must_visit', 'nice_to_visit')),
  ADD COLUMN IF NOT EXISTS expected_duration_min INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS visit_outcome TEXT;

-- Add optimization mode to saved_routes
ALTER TABLE saved_routes
  ADD COLUMN IF NOT EXISTS optimization_mode TEXT DEFAULT 'fastest'
    CHECK (optimization_mode IN ('fastest', 'shortest', 'strict_time_windows'));
