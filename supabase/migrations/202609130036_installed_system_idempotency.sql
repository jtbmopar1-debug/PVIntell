-- Prevent repeated form submissions or network retries from creating duplicate
-- installed Site/system workspaces. The API reserves one opaque request key per
-- authenticated owner and replays the completed result for subsequent calls.

create table public.installed_system_creation_requests (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  request_payload jsonb not null,
  status text not null default 'processing' check (status in ('processing', 'completed')),
  site_id uuid references public.sites(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (owner_id, idempotency_key),
  check ((status = 'processing' and site_id is null and project_id is null and completed_at is null)
    or (status = 'completed' and site_id is not null and project_id is not null and completed_at is not null))
);

alter table public.installed_system_creation_requests enable row level security;

create policy "installed_system_creation_requests_owner_all"
on public.installed_system_creation_requests
for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

