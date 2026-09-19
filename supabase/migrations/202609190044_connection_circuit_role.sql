alter table public.system_connections
  add column if not exists circuit_role text not null default 'unspecified'
  check (circuit_role in ('pv_dc', 'battery_dc', 'auxiliary_dc', 'unspecified'));

comment on column public.system_connections.circuit_role is
  'Purpose of a DC connection, kept separate from its user-facing name and physical connection type.';
