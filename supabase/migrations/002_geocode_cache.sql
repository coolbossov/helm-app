-- Geocode cache: one address = one API call, stored forever
create table if not exists geocode_cache (
  id uuid primary key default gen_random_uuid(),
  address_input text unique not null,
  latitude double precision,
  longitude double precision,
  formatted_address text,
  status text not null default 'OK'
    check (status in ('OK', 'ZERO_RESULTS', 'ERROR')),
  created_at timestamptz not null default now()
);

create index if not exists idx_geocode_address on geocode_cache (address_input);

-- RLS
alter table geocode_cache enable row level security;

create policy "Authenticated users can read geocode cache"
  on geocode_cache for select
  to authenticated
  using (true);

create policy "Service role can manage geocode cache"
  on geocode_cache for all
  to service_role
  using (true)
  with check (true);
