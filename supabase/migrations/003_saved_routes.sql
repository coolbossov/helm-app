-- Saved routes: planned driving routes
create table if not exists saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed')),
  total_distance_meters integer,
  total_duration_seconds integer,
  planned_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_routes_user on saved_routes (user_id);
create index if not exists idx_routes_status on saved_routes (status);

-- RLS
alter table saved_routes enable row level security;

create policy "Users can manage own routes"
  on saved_routes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
