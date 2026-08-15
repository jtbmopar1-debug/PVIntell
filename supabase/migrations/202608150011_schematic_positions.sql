create table public.system_schematic_positions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  node_ref text not null,
  position_x double precision not null,
  position_y double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_schematic_positions_unique_node unique (project_id, node_ref)
);

create index system_schematic_positions_project_idx
  on public.system_schematic_positions(project_id);

create trigger system_schematic_positions_set_updated_at
before update on public.system_schematic_positions
for each row execute function public.set_updated_at();

alter table public.system_schematic_positions enable row level security;

create policy "system_schematic_positions_owner_all"
on public.system_schematic_positions for all to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));
