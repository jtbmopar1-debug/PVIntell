-- Shared NASA POWER climatology cache, populated lazily by the server.
create table if not exists public.climate_region_cache (
  latitude numeric(4, 1) not null check (latitude between -90 and 90),
  longitude numeric(4, 1) not null check (longitude between -180 and 180),
  dataset_version text not null,
  period_start integer not null,
  period_end integer not null,
  months jsonb not null check (jsonb_typeof(months) = 'array'),
  fetched_at timestamptz not null default now(),
  primary key (latitude, longitude, dataset_version)
);

alter table public.climate_region_cache enable row level security;

comment on table public.climate_region_cache is
  'Server-managed temperature and solar climatology sourced from NASA POWER.';
