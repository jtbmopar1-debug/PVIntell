-- Add a property/site above each energy system (currently stored in projects).
-- Existing systems are preserved and grouped into one default site per owner.

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  location text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  timezone text not null default 'UTC',
  location_source text not null default 'manual'
    check (location_source in ('manual', 'device', 'search', 'imported')),
  location_confirmed boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create index sites_owner_id_idx on public.sites(owner_id);

alter table public.projects add column site_id uuid;

insert into public.sites (owner_id, name, location, timezone, location_source, location_confirmed)
select
  owner_id,
  'My site',
  max(location) filter (where location is not null and btrim(location) <> ''),
  'UTC',
  'imported',
  false
from public.projects
group by owner_id;

update public.projects p
set site_id = (
  select s.id
  from public.sites s
  where s.owner_id = p.owner_id
  order by s.created_at, s.id
  limit 1
);

alter table public.projects alter column site_id set not null;
alter table public.projects
  add constraint projects_site_owner_fk
  foreign key (site_id, owner_id)
  references public.sites(id, owner_id)
  on delete cascade;

create index projects_site_id_idx on public.projects(site_id);

create trigger sites_set_updated_at before update on public.sites
for each row execute function public.set_updated_at();

create or replace function public.owns_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sites
    where id = target_site_id and owner_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_site(uuid) from public;
grant execute on function public.owns_site(uuid) to authenticated;

alter table public.sites enable row level security;

create policy "sites_select_own" on public.sites
for select to authenticated using (owner_id = (select auth.uid()));
create policy "sites_insert_own" on public.sites
for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "sites_update_own" on public.sites
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create policy "sites_delete_own" on public.sites
for delete to authenticated using (owner_id = (select auth.uid()));

