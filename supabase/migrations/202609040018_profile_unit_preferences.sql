alter table public.profiles
add column if not exists unit_preferences jsonb not null default '{
  "temperature": "c",
  "windSpeed": "ms",
  "rainfall": "mm",
  "distance": "km",
  "dimensions": "metric",
  "weight": "kg",
  "pressure": "hpa"
}'::jsonb;

comment on column public.profiles.unit_preferences is
  'Signed-in measurement display preferences shared across browsers and installed PWAs.';
