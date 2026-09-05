alter table public.monitoring_connections add column if not exists is_active boolean not null default false;

with ranked as (
  select id, row_number() over (partition by owner_id, project_id order by created_at desc, id desc) as position
  from public.monitoring_connections
)
update public.monitoring_connections c set is_active = (ranked.position = 1)
from ranked where ranked.id = c.id;

create unique index if not exists monitoring_connections_one_active_per_system_uidx
  on public.monitoring_connections(owner_id, project_id) where is_active;

comment on column public.monitoring_connections.is_active is
  'The connection currently allowed to supply this system. Other saved connections remain available but inactive.';
