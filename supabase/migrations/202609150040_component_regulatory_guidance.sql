-- Canonical regulatory topics live in the application component library.
-- This table caches the current, cited jurisdiction overlay researched for a
-- user so every component of the same type at the same confirmed Site
-- jurisdiction can reuse it without copying rules onto equipment records.
create table public.component_regulatory_guidance (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  component_kind text not null check (component_kind in ('panel','pv_string','battery','inverter','charger','generator','protection','isolator','cable','connector','combiner','meter','monitoring','load','other')),
  subject_key text not null,
  jurisdiction_key text not null,
  jurisdiction_label text not null,
  topic_library_version integer not null,
  guidance_markdown text not null,
  citations jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now(),
  refresh_after timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, subject_key, jurisdiction_key, topic_library_version)
);

create index component_regulatory_guidance_owner_lookup_idx
  on public.component_regulatory_guidance(owner_id, jurisdiction_key, component_kind, subject_key);

alter table public.component_regulatory_guidance enable row level security;
create policy "regulatory guidance owners select" on public.component_regulatory_guidance
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "regulatory guidance owners insert" on public.component_regulatory_guidance
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "regulatory guidance owners update" on public.component_regulatory_guidance
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "regulatory guidance owners delete" on public.component_regulatory_guidance
  for delete to authenticated using (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.component_regulatory_guidance to authenticated;

comment on table public.component_regulatory_guidance is
  'Cached current-jurisdiction overlay for canonical component regulatory topics; not a component-specific compliance approval.';
