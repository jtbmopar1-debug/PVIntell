-- Shared daily solar-weather cache. Only trusted server credentials may read or write it.

create table public.weather_forecast_cache (
  location_key text not null,
  local_date date not null,
  timezone text not null,
  latitude double precision not null,
  longitude double precision not null,
  payload jsonb,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (location_key, local_date)
);

create index weather_forecast_cache_fetched_at_idx on public.weather_forecast_cache(fetched_at);

create trigger weather_forecast_cache_set_updated_at
before update on public.weather_forecast_cache
for each row execute function public.set_updated_at();

alter table public.weather_forecast_cache enable row level security;

-- Intentionally no user policies. The authenticated weather route reads this with
-- PVIntell's server-only Supabase secret so clients cannot poison shared forecasts.
