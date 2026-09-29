-- Build completion and handover evidence must follow the system across devices.
-- Wattson reviews are planning support records, not inspection or certification.
create table if not exists public.system_build_modules (
  project_id uuid not null references public.projects(id) on delete cascade,
  module_id text not null,
  complete boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (project_id, module_id),
  constraint system_build_modules_module_id_check
    check (module_id in ('pv-array', 'pv-dc', 'battery', 'inverter', 'ac', 'generator', 'earthing'))
);

create table if not exists public.system_handover_modules (
  project_id uuid not null references public.projects(id) on delete cascade,
  module_id text not null,
  observations text not null default '',
  readings text not null default '',
  documents text not null default '',
  issues text not null default '',
  screening_answers jsonb not null default '{}'::jsonb,
  complete boolean not null default false,
  review_status text not null default 'unreviewed',
  review_summary text,
  review_findings jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, module_id),
  constraint system_handover_modules_module_id_check
    check (module_id in ('pv-array', 'pv-dc', 'battery', 'inverter', 'ac', 'generator', 'earthing')),
  constraint system_handover_modules_review_status_check
    check (review_status in ('unreviewed', 'ready', 'needs_attention', 'insufficient_information', 'critical_issue')),
  constraint system_handover_modules_review_findings_check
    check (jsonb_typeof(review_findings) = 'array'),
  constraint system_handover_modules_screening_answers_check
    check (jsonb_typeof(screening_answers) = 'object')
);

-- Keep the working migration safe to re-run if its earlier draft was applied
-- manually during development.
alter table public.system_handover_modules
  add column if not exists screening_answers jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'system_handover_modules_screening_answers_check'
      and conrelid = 'public.system_handover_modules'::regclass
  ) then
    alter table public.system_handover_modules
      add constraint system_handover_modules_screening_answers_check
      check (jsonb_typeof(screening_answers) = 'object');
  end if;
end;
$$;

drop trigger if exists system_build_modules_set_updated_at on public.system_build_modules;
create trigger system_build_modules_set_updated_at
before update on public.system_build_modules
for each row execute function public.set_updated_at();

drop trigger if exists system_handover_modules_set_updated_at on public.system_handover_modules;
create trigger system_handover_modules_set_updated_at
before update on public.system_handover_modules
for each row execute function public.set_updated_at();

alter table public.system_build_modules enable row level security;
alter table public.system_handover_modules enable row level security;

drop policy if exists "system_build_modules_owner_all" on public.system_build_modules;
create policy "system_build_modules_owner_all"
on public.system_build_modules for all to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

drop policy if exists "system_handover_modules_owner_all" on public.system_handover_modules;
create policy "system_handover_modules_owner_all"
on public.system_handover_modules for all to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

grant select, insert, update, delete on public.system_build_modules to authenticated;
grant select, insert, update, delete on public.system_handover_modules to authenticated;

-- Final handover is one lifecycle operation: every module required by the
-- accepted design must be built and reviewed before proposal records become
-- the installed system record.
create or replace function public.complete_system_handover(
  target_project_id uuid,
  required_modules text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.owns_project(target_project_id) then
    raise exception 'Power system not found';
  end if;

  if cardinality(required_modules) = 0
    or not required_modules <@ array['pv-array', 'pv-dc', 'battery', 'inverter', 'ac', 'generator', 'earthing']::text[]
  then
    raise exception 'The accepted design does not contain a valid build plan';
  end if;

  if exists (
    select 1
    from unnest(required_modules) as required(module_id)
    where not exists (
      select 1
      from public.system_build_modules build_module
      where build_module.project_id = target_project_id
        and build_module.module_id = required.module_id
        and build_module.complete
    )
  ) then
    raise exception 'Complete every Build It module first';
  end if;

  if exists (
    select 1
    from unnest(required_modules) as required(module_id)
    where not exists (
      select 1
      from public.system_handover_modules handover_module
      where handover_module.project_id = target_project_id
        and handover_module.module_id = required.module_id
        and handover_module.complete
        and handover_module.review_status in ('ready', 'needs_attention')
    )
  ) then
    raise exception 'Complete Wattson review for every handover module first';
  end if;

  update public.system_components
  set confidence = 'confirmed'
  where project_id = target_project_id;

  update public.pv_arrays
  set confidence = 'confirmed'
  where project_id = target_project_id;

  update public.system_connections
  set confidence = 'confirmed'
  where project_id = target_project_id;

  update public.projects
  set phase = 'monitor'
  where id = target_project_id;
end;
$$;

revoke all on function public.complete_system_handover(uuid, text[]) from public;
grant execute on function public.complete_system_handover(uuid, text[]) to authenticated;
