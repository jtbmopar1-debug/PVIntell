alter table public.profiles
  add column if not exists theme_preference text not null default 'light'
  check (theme_preference in ('light', 'dark'));

comment on column public.profiles.theme_preference is
  'PVIntell colour theme: light or dark.';
