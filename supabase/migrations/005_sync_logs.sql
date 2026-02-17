-- Sync logs: audit trail for CRM sync operations
create table if not exists sync_logs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  contacts_synced integer not null default 0,
  contacts_created integer not null default 0,
  contacts_updated integer not null default 0,
  contacts_geocoded integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_logs_status on sync_logs (status);
create index if not exists idx_sync_logs_created on sync_logs (created_at desc);

-- RLS
alter table sync_logs enable row level security;

create policy "Authenticated users can read sync logs"
  on sync_logs for select
  to authenticated
  using (true);

create policy "Service role can manage sync logs"
  on sync_logs for all
  to service_role
  using (true)
  with check (true);
