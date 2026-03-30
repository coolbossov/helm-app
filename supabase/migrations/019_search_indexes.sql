-- GIN trigram indexes for fast ILIKE search on key string columns.
-- Requires pg_trgm extension (available in Supabase by default).
create extension if not exists pg_trgm;

-- Fast ILIKE search on synced_companies.company_name (used in contacts search + account_name join)
create index if not exists idx_synced_companies_company_name_trgm
  on synced_companies using gin (company_name gin_trgm_ops);

-- Fast ILIKE search on synced_contacts.account_name (used in company→contact resolution)
create index if not exists idx_synced_contacts_account_name_trgm
  on synced_contacts using gin (account_name gin_trgm_ops);

-- Index on visit_status for filtered map loads
create index if not exists idx_synced_companies_visit_status
  on synced_companies (visit_status)
  where visit_status is not null;

-- Index on last_visit_date for overdue filtering
create index if not exists idx_synced_companies_last_visit_date
  on synced_companies (last_visit_date)
  where last_visit_date is not null;

-- Index on contact_activities.contact_id (most common query pattern)
create index if not exists idx_contact_activities_contact_id
  on contact_activities (contact_id, created_at desc);
