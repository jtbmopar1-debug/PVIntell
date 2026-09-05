-- System previously followed the device setting. Light is now the explicit
-- default and the interface offers one compact Light/Dark toggle.
update public.profiles
set theme_preference = 'light'
where theme_preference = 'system';

alter table public.profiles
  alter column theme_preference set default 'light';

alter table public.profiles
  drop constraint if exists profiles_theme_preference_check;

alter table public.profiles
  add constraint profiles_theme_preference_check
  check (theme_preference in ('light', 'dark'));

comment on column public.profiles.theme_preference is
  'PVIntell colour theme: light or dark.';
