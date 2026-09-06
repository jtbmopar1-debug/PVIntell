alter table public.profiles
add column if not exists dashboard_default_site_id uuid references public.sites(id) on delete set null;

comment on column public.profiles.dashboard_default_site_id is
  'The Site shown by default on the signed-in dashboard when no Site is specified in the URL.';
