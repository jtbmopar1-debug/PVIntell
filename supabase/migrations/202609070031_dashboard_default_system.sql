alter table public.profiles
add column if not exists dashboard_default_system_id uuid references public.projects(id) on delete set null;

comment on column public.profiles.dashboard_default_system_id is
  'The preferred system whose Site supplies the default dashboard weather and system context.';
