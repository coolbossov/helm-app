-- Synced contacts: local mirror of Zoho Bigin contacts with geocoded lat/lng
create table if not exists synced_contacts (
  id uuid primary key default gen_random_uuid(),
  zoho_id text unique not null,

  -- Identity
  last_name text not null,
  first_name text,
  account_name text,
  email text,
  phone text,
  mobile text,
  website text,

  -- Address
  mailing_street text,
  mailing_city text,
  mailing_state text,
  mailing_zip text,
  mailing_country text,

  -- Geocoding
  latitude double precision,
  longitude double precision,
  geocode_status text not null default 'pending'
    check (geocode_status in ('pending', 'success', 'failed', 'no_address')),

  -- Filter fields
  business_type text[] not null default '{}',
  priority text check (priority in ('High Priority', 'Medium Priority', 'Low Priority')),
  lifecycle_stage text,
  contacting_status text,

  -- Notes
  contacting_tips text,
  prospecting_notes text,

  -- Sync metadata
  zoho_created_time timestamptz,
  zoho_modified_time timestamptz,
  last_synced_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_contacts_business_type on synced_contacts using gin (business_type);
create index if not exists idx_contacts_priority on synced_contacts (priority);
create index if not exists idx_contacts_lifecycle on synced_contacts (lifecycle_stage);
create index if not exists idx_contacts_geocode_status on synced_contacts (geocode_status);
create index if not exists idx_contacts_lat_lng on synced_contacts (latitude, longitude)
  where latitude is not null and longitude is not null;

-- RLS
alter table synced_contacts enable row level security;

create policy "Authenticated users can read contacts"
  on synced_contacts for select
  to authenticated
  using (true);

create policy "Service role can manage contacts"
  on synced_contacts for all
  to service_role
  using (true)
  with check (true);
