-- RPC: bulk update stop_order for multiple route_stops in a single atomic statement.
-- Used by the optimize route API to avoid N sequential UPDATE calls.
-- Input: JSON array of {id: uuid, stop_order: int} objects.
create or replace function bulk_update_stop_order(
  stop_orders jsonb  -- e.g. [{"id": "uuid", "stop_order": 0}, ...]
)
returns void
language sql
security definer
set search_path = public  -- Prevent search_path injection on SECURITY DEFINER functions
as $$
  update route_stops rs
  set stop_order = (v.stop_order)::integer
  from (
    select
      (elem->>'id')::uuid   as id,
      (elem->>'stop_order') as stop_order
    from jsonb_array_elements(stop_orders) as elem
  ) v
  where rs.id = v.id;
$$;
