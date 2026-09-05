-- Provider-neutral monitoring records. Provider secrets are deliberately not
-- stored here; connections reference server-side credentials by connection id.
create extension if not exists supabase_vault with schema vault;

do $$ begin create type public.monitoring_provider as enum ('dess_monitor', 'victron_vrm', 'solarman', 'junctek_local', 'pvintell_gateway'); exception when duplicate_object then null; end $$;
alter type public.monitoring_provider add value if not exists 'junctek_local';
do $$ begin create type public.monitoring_connection_status as enum ('setup_required', 'connecting', 'connected', 'degraded', 'error', 'disabled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.monitoring_sync_status as enum ('running', 'success', 'failed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.monitoring_alert_severity as enum ('info', 'warning', 'critical'); exception when duplicate_object then null; end $$;

create or replace function public.owns_monitoring_scope(target_owner_id uuid, target_site_id uuid, target_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_owner_id = (select auth.uid()) and exists (
    select 1 from public.projects p
    where p.id = target_project_id and p.site_id = target_site_id and p.owner_id = target_owner_id
  );
$$;
revoke all on function public.owns_monitoring_scope(uuid, uuid, uuid) from public;
grant execute on function public.owns_monitoring_scope(uuid, uuid, uuid) to authenticated;

create table if not exists public.monitoring_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  provider public.monitoring_provider not null,
  display_name text not null,
  provider_account_ref text,
  credential_secret_ref uuid unique,
  status public.monitoring_connection_status not null default 'setup_required',
  status_message text,
  capabilities text[] not null default '{}',
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id, site_id, project_id),
  unique (project_id, provider, provider_account_ref)
);
alter table public.monitoring_connections add column if not exists credential_secret_ref uuid;
create unique index if not exists monitoring_connections_credential_secret_ref_uidx on public.monitoring_connections(credential_secret_ref) where credential_secret_ref is not null;
comment on table public.monitoring_connections is 'Non-secret provider connection metadata. credential_secret_ref points to Supabase Vault; credentials must never be stored in this table.';
comment on column public.monitoring_connections.credential_secret_ref is 'Opaque reference to vault.secrets. Never resolve or expose this value in client responses.';

-- These functions are the only application-facing Vault boundary. They are
-- intentionally executable only by the service role and require the complete
-- owner/site/project/connection scope even though that role bypasses RLS.
create or replace function public.store_monitoring_connection_secret(
  target_owner_id uuid,
  target_site_id uuid,
  target_project_id uuid,
  target_connection_id uuid,
  secret_value text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  existing_ref uuid;
  stored_ref uuid;
begin
  if secret_value is null or length(secret_value) = 0 then
    raise exception 'Monitoring credential cannot be empty';
  end if;

  select credential_secret_ref into existing_ref
  from public.monitoring_connections
  where id = target_connection_id
    and owner_id = target_owner_id
    and site_id = target_site_id
    and project_id = target_project_id
  for update;

  if not found then raise exception 'Monitoring connection scope not found'; end if;

  if existing_ref is null then
    select vault.create_secret(
      secret_value,
      'pvintell-monitoring-' || target_connection_id::text,
      'PVIntell monitoring provider credential'
    ) into stored_ref;
    update public.monitoring_connections
      set credential_secret_ref = stored_ref
      where id = target_connection_id;
  else
    perform vault.update_secret(existing_ref, secret_value);
    stored_ref := existing_ref;
  end if;

  return stored_ref;
end;
$$;

create or replace function public.resolve_monitoring_connection_secret(
  target_owner_id uuid,
  target_site_id uuid,
  target_project_id uuid,
  target_connection_id uuid
) returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where id = (
    select credential_secret_ref
    from public.monitoring_connections
    where id = target_connection_id
      and owner_id = target_owner_id
      and site_id = target_site_id
      and project_id = target_project_id
  );
$$;

create or replace function public.delete_monitoring_connection_secret(
  target_owner_id uuid,
  target_site_id uuid,
  target_project_id uuid,
  target_connection_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare target_ref uuid;
begin
  select credential_secret_ref into target_ref
  from public.monitoring_connections
  where id = target_connection_id
    and owner_id = target_owner_id
    and site_id = target_site_id
    and project_id = target_project_id
  for update;

  if not found then raise exception 'Monitoring connection scope not found'; end if;
  if target_ref is not null then
    delete from vault.secrets where id = target_ref;
    update public.monitoring_connections set credential_secret_ref = null where id = target_connection_id;
  end if;
end;
$$;

revoke all on function public.store_monitoring_connection_secret(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.resolve_monitoring_connection_secret(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.delete_monitoring_connection_secret(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.store_monitoring_connection_secret(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function public.resolve_monitoring_connection_secret(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.delete_monitoring_connection_secret(uuid, uuid, uuid, uuid) to service_role;

create or replace function public.delete_monitoring_vault_secret_on_connection_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.credential_secret_ref is not null then delete from vault.secrets where id = old.credential_secret_ref; end if;
  return old;
end;
$$;
revoke all on function public.delete_monitoring_vault_secret_on_connection_delete() from public, anon, authenticated;
drop trigger if exists monitoring_connection_delete_vault_secret on public.monitoring_connections;
create trigger monitoring_connection_delete_vault_secret before delete on public.monitoring_connections
for each row execute function public.delete_monitoring_vault_secret_on_connection_delete();

create table if not exists public.monitoring_devices (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null,
  owner_id uuid not null,
  site_id uuid not null,
  project_id uuid not null,
  provider_device_id text not null,
  device_type text not null,
  display_name text not null,
  mapped_component_id uuid references public.system_components(id) on delete set null,
  mapped_pv_array_id uuid references public.pv_arrays(id) on delete set null,
  status text not null default 'unknown' check (status in ('online', 'offline', 'unknown', 'error')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, owner_id, site_id, project_id) references public.monitoring_connections(id, owner_id, site_id, project_id) on delete cascade,
  unique (connection_id, provider_device_id),
  check (num_nonnulls(mapped_component_id, mapped_pv_array_id) <= 1)
);

create table if not exists public.monitoring_latest_readings (
  project_id uuid primary key,
  connection_id uuid not null,
  owner_id uuid not null,
  site_id uuid not null,
  measured_at timestamptz not null,
  received_at timestamptz not null default now(),
  pv_power_w double precision,
  load_power_w double precision,
  battery_power_w double precision,
  battery_voltage_v double precision,
  battery_current_a double precision,
  battery_soc_percent double precision check (battery_soc_percent between 0 and 100),
  grid_power_w double precision,
  inverter_state text,
  generated_energy_today_wh double precision,
  consumed_energy_today_wh double precision,
  foreign key (connection_id, owner_id, site_id, project_id) references public.monitoring_connections(id, owner_id, site_id, project_id) on delete cascade
);

create table if not exists public.monitoring_samples (
  id bigint generated always as identity primary key,
  connection_id uuid not null,
  owner_id uuid not null,
  site_id uuid not null,
  project_id uuid not null,
  measured_at timestamptz not null,
  received_at timestamptz not null default now(),
  pv_power_w double precision,
  load_power_w double precision,
  battery_power_w double precision,
  battery_voltage_v double precision,
  battery_current_a double precision,
  battery_soc_percent double precision check (battery_soc_percent between 0 and 100),
  grid_power_w double precision,
  inverter_state text,
  generated_energy_today_wh double precision,
  consumed_energy_today_wh double precision,
  foreign key (connection_id, owner_id, site_id, project_id) references public.monitoring_connections(id, owner_id, site_id, project_id) on delete cascade,
  unique (connection_id, measured_at)
);
create index if not exists monitoring_samples_scope_time_idx on public.monitoring_samples(owner_id, site_id, project_id, measured_at desc);

create table if not exists public.monitoring_alerts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null,
  owner_id uuid not null,
  site_id uuid not null,
  project_id uuid not null,
  provider_alert_id text,
  code text,
  severity public.monitoring_alert_severity not null,
  title text not null,
  message text,
  status text not null default 'active' check (status in ('active', 'acknowledged', 'resolved')),
  occurred_at timestamptz not null,
  resolved_at timestamptz,
  foreign key (connection_id, owner_id, site_id, project_id) references public.monitoring_connections(id, owner_id, site_id, project_id) on delete cascade,
  unique (connection_id, provider_alert_id)
);
create index if not exists monitoring_alerts_scope_status_idx on public.monitoring_alerts(owner_id, site_id, project_id, status, occurred_at desc);

create table if not exists public.monitoring_sync_attempts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null,
  owner_id uuid not null,
  site_id uuid not null,
  project_id uuid not null,
  status public.monitoring_sync_status not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  samples_written integer not null default 0 check (samples_written >= 0),
  error_code text,
  error_message text,
  foreign key (connection_id, owner_id, site_id, project_id) references public.monitoring_connections(id, owner_id, site_id, project_id) on delete cascade
);
create index if not exists monitoring_sync_scope_time_idx on public.monitoring_sync_attempts(owner_id, site_id, project_id, started_at desc);

drop trigger if exists monitoring_connections_set_updated_at on public.monitoring_connections;
create trigger monitoring_connections_set_updated_at before update on public.monitoring_connections for each row execute function public.set_updated_at();
drop trigger if exists monitoring_devices_set_updated_at on public.monitoring_devices;
create trigger monitoring_devices_set_updated_at before update on public.monitoring_devices for each row execute function public.set_updated_at();

alter table public.monitoring_connections enable row level security;
alter table public.monitoring_devices enable row level security;
alter table public.monitoring_latest_readings enable row level security;
alter table public.monitoring_samples enable row level security;
alter table public.monitoring_alerts enable row level security;
alter table public.monitoring_sync_attempts enable row level security;

drop policy if exists monitoring_connections_select_own on public.monitoring_connections;
drop policy if exists monitoring_connections_insert_own on public.monitoring_connections;
drop policy if exists monitoring_connections_update_own on public.monitoring_connections;
drop policy if exists monitoring_connections_delete_own on public.monitoring_connections;
create policy monitoring_connections_select_own on public.monitoring_connections for select to authenticated using (public.owns_monitoring_scope(owner_id, site_id, project_id));
create policy monitoring_connections_insert_own on public.monitoring_connections for insert to authenticated with check (public.owns_monitoring_scope(owner_id, site_id, project_id));
create policy monitoring_connections_update_own on public.monitoring_connections for update to authenticated using (public.owns_monitoring_scope(owner_id, site_id, project_id)) with check (public.owns_monitoring_scope(owner_id, site_id, project_id));
create policy monitoring_connections_delete_own on public.monitoring_connections for delete to authenticated using (public.owns_monitoring_scope(owner_id, site_id, project_id));

drop policy if exists monitoring_devices_select_own on public.monitoring_devices;
drop policy if exists monitoring_latest_select_own on public.monitoring_latest_readings;
drop policy if exists monitoring_samples_select_own on public.monitoring_samples;
drop policy if exists monitoring_alerts_select_own on public.monitoring_alerts;
drop policy if exists monitoring_sync_select_own on public.monitoring_sync_attempts;
create policy monitoring_devices_select_own on public.monitoring_devices for select to authenticated using (public.owns_monitoring_scope(owner_id, site_id, project_id));
create policy monitoring_latest_select_own on public.monitoring_latest_readings for select to authenticated using (public.owns_monitoring_scope(owner_id, site_id, project_id));
create policy monitoring_samples_select_own on public.monitoring_samples for select to authenticated using (public.owns_monitoring_scope(owner_id, site_id, project_id));
create policy monitoring_alerts_select_own on public.monitoring_alerts for select to authenticated using (public.owns_monitoring_scope(owner_id, site_id, project_id));
create policy monitoring_sync_select_own on public.monitoring_sync_attempts for select to authenticated using (public.owns_monitoring_scope(owner_id, site_id, project_id));
