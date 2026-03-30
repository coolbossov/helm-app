alter table field_updates
  add column if not exists company_id uuid references synced_companies(id) on delete cascade;

create index if not exists idx_field_updates_company on field_updates (company_id);
