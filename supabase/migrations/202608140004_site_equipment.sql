-- Equipment owned at a site but not necessarily approved or installed in a system.

alter table public.projects add constraint projects_id_site_unique unique (id, site_id);

create table public.site_equipment (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  assigned_project_id uuid,
  type text not null,
  name text not null,
  manufacturer text,
  model text,
  serial_number text,
  quantity integer not null default 1 check (quantity > 0),
  condition text not null default 'unknown'
    check (condition in ('new', 'used_good', 'used_unknown', 'needs_testing', 'for_parts')),
  status text not null default 'available'
    check (status in ('available', 'considering', 'assigned', 'installed', 'rejected', 'retired')),
  specifications jsonb not null default '{}'::jsonb,
  source_notes text,
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  manual_url text,
  acquired_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assigned_project_id, site_id)
    references public.projects(id, site_id)
    on delete set null (assigned_project_id)
);

create index site_equipment_site_idx on public.site_equipment(site_id);
create index site_equipment_assigned_project_idx on public.site_equipment(assigned_project_id);

alter table public.system_components
  add column inventory_item_id uuid references public.site_equipment(id) on delete set null;

create trigger site_equipment_set_updated_at
before update on public.site_equipment
for each row execute function public.set_updated_at();

alter table public.site_equipment enable row level security;

create policy "site_equipment_owner_all"
on public.site_equipment
for all to authenticated
using (public.owns_site(site_id))
with check (public.owns_site(site_id));
