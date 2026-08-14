alter table public.system_components
  add column if not exists display_name text;

update public.system_components
set display_name = coalesce(model, initcap(replace(type::text, '_', ' ')))
where display_name is null;

alter table public.system_components
  alter column display_name set not null;
