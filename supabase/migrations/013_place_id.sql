-- Add place_id column to synced_contacts for Google Places deduplication.
-- Contacts added via Lead Discovery store their Google place_id here so we
-- can detect duplicates before adding again.

alter table synced_contacts
  add column if not exists place_id text;

-- Unique index allows fast duplicate checks and prevents the same place
-- being added twice (nulls are excluded from unique indexes in Postgres).
create unique index if not exists idx_contacts_place_id
  on synced_contacts (place_id)
  where place_id is not null;
