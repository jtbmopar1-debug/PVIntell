-- Separate circuits can share the same two equipment endpoints. For example,
-- a three-way PV fusebox may carry PV1, PV2 and PV3 as three independently
-- protected positive/negative cable pairs to three inverter MPPT inputs.
alter table public.system_connections
  drop constraint if exists system_connections_unique_link;

alter table public.system_connections
  add constraint system_connections_unique_link
    unique (project_id, source_ref, target_ref, name);

comment on constraint system_connections_unique_link on public.system_connections is
  'Prevents duplicate named circuits while allowing multiple physical circuits between the same equipment endpoints.';
