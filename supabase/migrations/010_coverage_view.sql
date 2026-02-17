create or replace view latest_contact_visits as
select distinct on (contact_id)
  contact_id,
  created_at as last_visited_at
from contact_activities
where activity_type = 'visit'
order by contact_id, created_at desc;
