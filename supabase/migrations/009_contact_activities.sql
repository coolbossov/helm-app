create table contact_activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references synced_contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null
    check (activity_type in ('visit','call','note','status_change','field_change')),
  title text,
  content text,
  metadata jsonb default '{}',
  bigin_synced boolean not null default false,
  bigin_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_activities_contact on contact_activities (contact_id, created_at desc);
create index idx_activities_bigin on contact_activities (bigin_synced) where not bigin_synced;

-- RLS
alter table contact_activities enable row level security;

create policy "Authenticated users can read all activities"
  on contact_activities for select
  to authenticated
  using (true);

create policy "Authenticated users can insert own activities"
  on contact_activities for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Service role full access"
  on contact_activities for all
  to service_role
  using (true)
  with check (true);
