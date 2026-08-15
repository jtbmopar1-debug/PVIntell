create table if not exists public.system_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_ref text not null,
  target_ref text not null,
  name text not null default 'Connection',
  connection_type text not null default 'other'
    check (connection_type in ('dc', 'ac', 'data', 'earth', 'other')),
  cable_size text,
  cable_length text,
  breaker_size text,
  fuse_size text,
  isolator text,
  route text,
  notes text,
  confidence public.confidence not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_connections_distinct_ends check (source_ref <> target_ref),
  constraint system_connections_unique_link unique (project_id, source_ref, target_ref)
);

create index if not exists system_connections_project_idx
  on public.system_connections(project_id);

create trigger system_connections_set_updated_at
before update on public.system_connections
for each row execute function public.set_updated_at();

alter table public.system_connections enable row level security;

create policy "system_connections_owner_all"
on public.system_connections for all to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));
