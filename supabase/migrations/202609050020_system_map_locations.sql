-- A Site is the property/location context. Each power system can also have its
-- own map position within that Site (for example the house and a remote shed).
-- Mobile systems retain only a user-updated guide position for Wattson.
alter table public.projects
  add column if not exists map_latitude double precision check (map_latitude between -90 and 90),
  add column if not exists map_longitude double precision check (map_longitude between -180 and 180),
  add column if not exists location_mode text not null default 'static'
    check (location_mode in ('static', 'mobile')),
  add column if not exists map_location_updated_at timestamptz;

update public.projects
set location_mode = 'mobile'
where lower(coalesce(settings #>> '{designDiscovery,proposed_panel_location,value}', '')) like '%mobile%'
   or lower(coalesce(settings #>> '{designDiscovery,building_type,value}', '')) like '%mobile%';

comment on column public.projects.map_latitude is 'User-confirmed map position of this system within its Site, or last guide position for a mobile system.';
comment on column public.projects.location_mode is 'Static installation or mobile system whose saved position is contextual rather than permanent.';
