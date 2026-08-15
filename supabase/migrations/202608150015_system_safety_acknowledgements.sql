-- Records specific system concerns and an owner's informed decision to retain
-- an as-built item or connection. An acknowledgement is not a compliance
-- approval, does not resolve or hide the concern, and does not change an
-- installation whose regulatory compliance is unknown or not verified.

create table if not exists public.system_safety_concerns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  target_kind text not null
    check (target_kind in ('system', 'component', 'pv_array', 'connection')),
  target_ref text,
  severity text not null
    check (severity in ('advisory', 'warning', 'serious', 'immediate')),
  title text not null,
  explanation text not null,
  evidence jsonb not null default '{}'::jsonb,
  recommendation text,
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved')),
  raised_by text not null default 'wattson'
    check (raised_by in ('wattson', 'rule', 'user', 'professional')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint system_safety_concerns_resolution_check check (
    (status = 'resolved' and resolved_at is not null)
    or (status <> 'resolved' and resolved_at is null)
  )
);

create index if not exists system_safety_concerns_project_idx
  on public.system_safety_concerns(project_id, status, severity);

create trigger system_safety_concerns_set_updated_at
before update on public.system_safety_concerns
for each row execute function public.set_updated_at();

alter table public.system_safety_concerns enable row level security;

create policy "system_safety_concerns_owner_all"
on public.system_safety_concerns for all to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

create table if not exists public.system_safety_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  concern_id uuid not null references public.system_safety_concerns(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null
    check (decision in ('retain_as_built', 'defer_for_review')),
  user_statement text not null,
  warning_snapshot jsonb not null,
  understands_concern_remains boolean not null,
  understands_not_compliance_approval boolean not null,
  acknowledged_at timestamptz not null default now(),
  constraint system_safety_acknowledgements_informed_check check (
    understands_concern_remains and understands_not_compliance_approval
  )
);

create index if not exists system_safety_acknowledgements_concern_idx
  on public.system_safety_acknowledgements(concern_id, acknowledged_at desc);

alter table public.system_safety_acknowledgements enable row level security;

create policy "system_safety_acknowledgements_owner_select"
on public.system_safety_acknowledgements for select to authenticated
using (owner_id = auth.uid() and public.owns_project(project_id));

create policy "system_safety_acknowledgements_owner_insert"
on public.system_safety_acknowledgements for insert to authenticated
with check (
  owner_id = auth.uid()
  and public.owns_project(project_id)
  and exists (
    select 1
    from public.system_safety_concerns concern
    where concern.id = concern_id
      and concern.project_id = project_id
  )
);

-- Acknowledgement rows intentionally have no update/delete policy. They are an
-- audit trail; resolution is recorded on the concern instead.
