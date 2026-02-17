-- Field updates: queue for mobile field updates to sync back to Zoho
create table if not exists field_updates (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references synced_contacts(id) on delete cascade,
  changes jsonb not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'syncing', 'synced', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create index if not exists idx_field_updates_status on field_updates (status);
create index if not exists idx_field_updates_contact on field_updates (contact_id);

-- RLS
alter table field_updates enable row level security;

create policy "Authenticated users can manage field updates"
  on field_updates for all
  to authenticated
  using (true)
  with check (true);

create policy "Service role can manage field updates"
  on field_updates for all
  to service_role
  using (true)
  with check (true);
