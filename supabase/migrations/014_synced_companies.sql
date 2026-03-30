-- Synced companies: local mirror of Zoho Bigin Accounts with geocoded lat/lng
create table if not exists synced_companies (
  id uuid primary key default gen_random_uuid(),
  zoho_account_id text unique not null,

  -- Identity
  company_name text not null,
  phone text,
  website text,

  -- Classification
  business_type text,

  -- Address
  billing_street text,
  billing_city text,
  billing_state text,
  billing_zip text,

  -- Geocoding
  latitude double precision,
  longitude double precision,
  geocode_status text not null default 'pending'
    check (geocode_status in ('pending', 'success', 'failed', 'no_address')),
  place_id text,

  -- App-managed fields
  visit_status text,
  last_visit_date date,
  priority text,
  lifecycle_stage text,
  contacting_status text,
  contacting_tips text,
  prospecting_notes text,

  -- Sync metadata
  zoho_modified_time timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_companies_business_type on synced_companies (business_type);
create index if not exists idx_companies_geocode on synced_companies (geocode_status);
create index if not exists idx_companies_lat_lng on synced_companies (latitude, longitude)
  where latitude is not null and longitude is not null;
create unique index if not exists idx_companies_place_id on synced_companies (place_id)
  where place_id is not null;

alter table synced_companies enable row level security;

create policy "Authenticated users can read companies"
  on synced_companies for select
  to authenticated
  using (true);

create policy "Service role can manage companies"
  on synced_companies for all
  to service_role
  using (true)
  with check (true);

drop trigger if exists trg_companies_updated_at on synced_companies;
create trigger trg_companies_updated_at
  before update on synced_companies
  for each row execute function update_updated_at();
