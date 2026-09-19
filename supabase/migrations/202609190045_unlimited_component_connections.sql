-- Components may have any number of independently recorded links, including
-- multiple conductors, communications and power circuits between the same
-- pair of components. Connection identity is the row id, not its endpoints.
alter table public.system_connections
  drop constraint if exists system_connections_unique_link;
