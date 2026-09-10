-- Daily observations are independent of telemetry, discovery and proposal data.
create table public.monitor_daily_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  log_date date not null,
  timezone text not null,
  observations jsonb not null default '{}'::jsonb,
  forecast jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, log_date),
  check (jsonb_typeof(observations) = 'object'),
  check (forecast is null or jsonb_typeof(forecast) = 'object')
);
create index monitor_daily_entries_owner_date on public.monitor_daily_entries(owner_id, log_date);
alter table public.monitor_daily_entries enable row level security;
create policy daily_log_owner_scope on public.monitor_daily_entries for all to authenticated
  using (public.owns_monitoring_scope(owner_id, site_id, project_id))
  with check (public.owns_monitoring_scope(owner_id, site_id, project_id));
grant select, insert, update, delete on public.monitor_daily_entries to authenticated;
comment on table public.monitor_daily_entries is 'User-reported daily solar/SOC/generator observations plus a frozen forecast snapshot. Never provider telemetry.';
