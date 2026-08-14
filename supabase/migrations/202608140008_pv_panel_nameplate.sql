-- Explicit per-panel electrical nameplate values and the source label image.

alter table public.pv_arrays
  add column maximum_power_voltage_v double precision,
  add column maximum_power_current_a double precision,
  add column open_circuit_voltage_v double precision,
  add column short_circuit_current_a double precision,
  add column maximum_system_voltage_v double precision,
  add column nominal_operating_cell_temp_c double precision,
  add column maximum_series_fuse_a double precision,
  add column label_photo_path text;

comment on column public.pv_arrays.maximum_power_voltage_v is 'Per-panel voltage at maximum power (Vmp).';
comment on column public.pv_arrays.maximum_power_current_a is 'Per-panel current at maximum power (Imp).';
comment on column public.pv_arrays.open_circuit_voltage_v is 'Per-panel open-circuit voltage (Voc).';
comment on column public.pv_arrays.short_circuit_current_a is 'Per-panel short-circuit current (Isc).';
