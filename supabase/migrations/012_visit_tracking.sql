-- Migration 012: Visit tracking fields
-- Adds visit_status and last_visit_date to synced_contacts.
-- These fields live in Supabase only (Bigin field limit reached).
-- visit_status is set manually via the helm-app UI.
-- last_visit_date is updated when a 'visit' activity is logged.

alter table synced_contacts
  add column if not exists visit_status text
    check (visit_status in (
      'Never Visited',
      'Visited Recently',
      'Needs Follow-up',
      'Hot Lead',
      'Not Interested',
      'Closed Won'
    )),
  add column if not exists last_visit_date date;

-- Default all existing records to 'Never Visited'
update synced_contacts
  set visit_status = 'Never Visited'
  where visit_status is null;

-- For any contacts that already have a visit activity logged, back-fill
-- last_visit_date and set status to 'Visited Recently'
update synced_contacts sc
  set
    last_visit_date = sub.latest_visit::date,
    visit_status = case
      when (now() - sub.latest_visit) < interval '30 days' then 'Visited Recently'
      when (now() - sub.latest_visit) < interval '90 days' then 'Needs Follow-up'
      else 'Needs Follow-up'
    end
  from (
    select
      contact_id,
      max(created_at) as latest_visit
    from contact_activities
    where activity_type = 'visit'
    group by contact_id
  ) sub
  where sc.id = sub.contact_id;

-- Index for filtering by visit status on the map
create index if not exists idx_contacts_visit_status
  on synced_contacts (visit_status);

create index if not exists idx_contacts_last_visit_date
  on synced_contacts (last_visit_date);

-- Trigger: auto-update last_visit_date + visit_status when a visit activity is inserted
create or replace function update_contact_visit_info()
returns trigger as $$
begin
  if new.activity_type = 'visit' then
    update synced_contacts
      set
        last_visit_date = new.created_at::date,
        visit_status = 'Visited Recently',
        updated_at = now()
      where id = new.contact_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_update_visit_info on contact_activities;
create trigger trg_update_visit_info
  after insert on contact_activities
  for each row
  execute function update_contact_visit_info();

-- Allow authenticated users to update visit_status and last_visit_date
create policy "Authenticated users can update visit fields"
  on synced_contacts for update
  to authenticated
  using (true)
  with check (true);
