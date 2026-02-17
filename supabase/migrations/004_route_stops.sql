-- Route stops: ordered stops within a route
create table if not exists route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references saved_routes(id) on delete cascade,
  contact_id uuid not null references synced_contacts(id) on delete cascade,
  stop_order integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'visited', 'skipped')),
  visit_notes text,
  visited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_stops_route on route_stops (route_id, stop_order);
create index if not exists idx_stops_contact on route_stops (contact_id);

-- RLS
alter table route_stops enable row level security;

create policy "Users can manage stops on own routes"
  on route_stops for all
  to authenticated
  using (
    exists (
      select 1 from saved_routes
      where saved_routes.id = route_stops.route_id
        and saved_routes.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from saved_routes
      where saved_routes.id = route_stops.route_id
        and saved_routes.user_id = auth.uid()
    )
  );
