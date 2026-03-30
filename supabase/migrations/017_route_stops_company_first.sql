-- Allow route stops to reference companies directly.
alter table route_stops
  alter column contact_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'route_stops_requires_contact_or_company'
      and conrelid = 'route_stops'::regclass
  ) then
    alter table route_stops
      add constraint route_stops_requires_contact_or_company
      check (contact_id is not null or company_id is not null);
  end if;
end $$;
