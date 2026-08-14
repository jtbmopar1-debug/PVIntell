-- Make PV arrays first-class, progressively completed system records.

alter table public.pv_arrays alter column panel_watts drop not null;
alter table public.pv_arrays alter column panel_count drop not null;
alter table public.pv_arrays
  add column manufacturer text,
  add column panel_model text,
  add column orientation_degrees double precision,
  add column tilt_degrees double precision,
  add column cable_size_mm2 double precision,
  add column cable_length_m double precision,
  add column connector_type text,
  add column breaker_details text,
  add column isolator_details text,
  add column combiner_details text,
  add column installation_notes text,
  add column confidence public.confidence not null default 'estimated',
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

create trigger pv_arrays_set_updated_at
before update on public.pv_arrays
for each row execute function public.set_updated_at();
