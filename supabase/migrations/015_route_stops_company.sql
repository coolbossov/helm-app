alter table route_stops
  add column if not exists company_id uuid references synced_companies(id) on delete cascade;

create index if not exists idx_stops_company on route_stops (company_id);
