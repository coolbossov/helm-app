-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_contacts_updated_at
  before update on synced_contacts
  for each row execute function update_updated_at();

create trigger trg_routes_updated_at
  before update on saved_routes
  for each row execute function update_updated_at();
