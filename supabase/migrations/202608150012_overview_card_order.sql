create table public.system_overview_card_order (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  node_ref text not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_overview_card_order_unique_node unique (project_id, node_ref)
);

create index system_overview_card_order_project_idx
  on public.system_overview_card_order(project_id, position);

create trigger system_overview_card_order_set_updated_at
before update on public.system_overview_card_order
for each row execute function public.set_updated_at();

alter table public.system_overview_card_order enable row level security;

create policy "system_overview_card_order_owner_all"
on public.system_overview_card_order for all to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));
