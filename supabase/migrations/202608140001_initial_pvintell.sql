-- PVIntell initial Supabase schema
-- Run with `supabase db push` or paste into the Supabase SQL editor.
-- Authentication is owned by Supabase Auth (`auth.users`).

create extension if not exists pgcrypto;

create type public.confidence as enum ('estimated', 'confirmed');
create type public.project_mode as enum ('off_grid', 'grid_tied', 'hybrid');
create type public.message_role as enum ('user', 'assistant', 'system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  mode public.project_mode not null,
  phase text not null default 'discover',
  location text,
  system_voltage double precision,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects(owner_id);

create table public.project_goals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  text text not null,
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.assumptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  value jsonb not null,
  reason text,
  confidence public.confidence not null default 'estimated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.system_components (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  manufacturer text,
  model text,
  quantity integer not null default 1 check (quantity > 0),
  specifications jsonb not null default '{}'::jsonb,
  notes text,
  installation_location text,
  serial_number text,
  firmware_version text,
  manual_url text,
  photo_url text,
  confidence public.confidence not null default 'estimated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pv_arrays (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  panel_watts double precision not null check (panel_watts > 0),
  panel_count integer not null check (panel_count > 0),
  strings integer check (strings > 0),
  panels_per_string integer check (panels_per_string > 0),
  specifications jsonb not null default '{}'::jsonb
);

create table public.battery_banks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  chemistry text not null,
  nominal_voltage double precision not null check (nominal_voltage > 0),
  nominal_kwh double precision not null check (nominal_kwh > 0),
  usable_kwh double precision not null check (usable_kwh > 0),
  specifications jsonb not null default '{}'::jsonb,
  check (usable_kwh <= nominal_kwh)
);

create table public.inverters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  continuous_watts double precision not null check (continuous_watts > 0),
  surge_watts double precision not null check (surge_watts >= continuous_watts),
  specifications jsonb not null default '{}'::jsonb
);

create table public.loads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  watts double precision not null check (watts >= 0),
  quantity integer not null default 1 check (quantity > 0),
  hours_per_day double precision not null check (hours_per_day between 0 and 24),
  surge_watts double precision check (surge_watts >= 0),
  current_type text not null default 'AC' check (current_type in ('AC', 'DC')),
  simultaneous boolean not null default true,
  confidence public.confidence not null default 'estimated'
);

create table public.installation_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  position integer not null,
  title text not null,
  instructions text not null,
  safety_level text not null,
  expected_result text,
  notes text,
  photo_urls jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  unique(project_id, position)
);

create table public.commissioning_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  value jsonb not null,
  expected_range jsonb,
  result text not null check (result in ('pass', 'attention', 'fail')),
  notes text,
  recorded_at timestamptz not null default now()
);

create table public.telemetry_readings (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  key text not null,
  numeric_value double precision,
  text_value text,
  unit text,
  source text not null,
  recorded_at timestamptz not null default now(),
  check (numeric_value is not null or text_value is not null)
);

create index telemetry_project_key_time_idx
  on public.telemetry_readings(project_id, key, recorded_at desc);

create table public.system_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  severity text not null,
  code text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index system_events_project_time_idx
  on public.system_events(project_id, occurred_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  severity text not null,
  status text not null default 'open',
  explanation text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  structured_context jsonb,
  created_at timestamptz not null default now()
);

create index chat_messages_conversation_time_idx
  on public.chat_messages(conversation_id, created_at);

-- Maintain timestamps without trusting clients to do it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
create trigger assumptions_set_updated_at before update on public.assumptions
for each row execute function public.set_updated_at();
create trigger components_set_updated_at before update on public.system_components
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

-- Every Supabase Auth signup receives an application profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Central ownership check used by child-table RLS policies.
create or replace function public.owns_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects
    where id = target_project_id and owner_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_project(uuid) from public;
grant execute on function public.owns_project(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_goals enable row level security;
alter table public.assumptions enable row level security;
alter table public.system_components enable row level security;
alter table public.pv_arrays enable row level security;
alter table public.battery_banks enable row level security;
alter table public.inverters enable row level security;
alter table public.loads enable row level security;
alter table public.installation_steps enable row level security;
alter table public.commissioning_records enable row level security;
alter table public.telemetry_readings enable row level security;
alter table public.system_events enable row level security;
alter table public.alerts enable row level security;
alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "projects_select_own" on public.projects for select to authenticated using (owner_id = (select auth.uid()));
create policy "projects_insert_own" on public.projects for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "projects_update_own" on public.projects for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "projects_delete_own" on public.projects for delete to authenticated using (owner_id = (select auth.uid()));

-- Identical owner-only policies for direct project children.
create policy "goals_owner_all" on public.project_goals for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "assumptions_owner_all" on public.assumptions for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "components_owner_all" on public.system_components for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "pv_arrays_owner_all" on public.pv_arrays for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "battery_banks_owner_all" on public.battery_banks for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "inverters_owner_all" on public.inverters for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "loads_owner_all" on public.loads for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "steps_owner_all" on public.installation_steps for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "commissioning_owner_all" on public.commissioning_records for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "telemetry_owner_all" on public.telemetry_readings for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "events_owner_all" on public.system_events for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "alerts_owner_all" on public.alerts for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "conversations_owner_all" on public.conversations for all to authenticated using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy "messages_owner_all" on public.chat_messages
for all to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.owns_project(c.project_id)
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and public.owns_project(c.project_id)
  )
);

-- Photos are private and stored beneath: {user_id}/{project_id}/{filename}
insert into storage.buckets (id, name, public)
values ('project-photos', 'project-photos', false)
on conflict (id) do nothing;

create policy "project_photos_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'project-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "project_photos_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'project-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "project_photos_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'project-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'project-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "project_photos_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'project-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Backfill profiles if Auth users existed before this migration.
insert into public.profiles (id, email, display_name, avatar_url)
select id, email,
       coalesce(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name'),
       raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;
