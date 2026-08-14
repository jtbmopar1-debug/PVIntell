-- Treat each PV record as one physical string and retain purchase provenance.

alter table public.pv_arrays
  add column panel_type text,
  add column supplier text,
  add column purchased_on date,
  add column installed_on date;

comment on table public.pv_arrays is
  'One row represents one independently documented PV string (PV1, PV2, etc.).';

comment on column public.pv_arrays.panel_type is
  'Panel construction such as monofacial, bifacial, thin-film or flexible.';
