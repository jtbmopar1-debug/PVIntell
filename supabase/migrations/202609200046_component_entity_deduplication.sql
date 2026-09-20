-- Every designed or captured item is a system-scoped entity.  Older proposal
-- flows could insert the same item repeatedly, so merge only records with the
-- same logical identity inside the same project before enforcing uniqueness.
begin;

create temporary table component_entity_merge on commit drop as
with ranked as (
  select
    id,
    first_value(id) over (
      partition by project_id, lower(type), lower(display_name),
        lower(coalesce(manufacturer, '')), lower(coalesce(model, ''))
      order by created_at, id
    ) as keep_id,
    row_number() over (
      partition by project_id, lower(type), lower(display_name),
        lower(coalesce(manufacturer, '')), lower(coalesce(model, ''))
      order by created_at, id
    ) as duplicate_number
  from public.system_components
)
select id as duplicate_id, keep_id
from ranked
where duplicate_number > 1;

create temporary table pv_array_entity_merge on commit drop as
with ranked as (
  select
    id,
    first_value(id) over (
      partition by project_id, lower(name), lower(coalesce(manufacturer, '')),
        lower(coalesce(panel_model, ''))
      order by created_at, id
    ) as keep_id,
    row_number() over (
      partition by project_id, lower(name), lower(coalesce(manufacturer, '')),
        lower(coalesce(panel_model, ''))
      order by created_at, id
    ) as duplicate_number
  from public.pv_arrays
)
select id as duplicate_id, keep_id
from ranked
where duplicate_number > 1;

-- Preserve the most recently recorded non-empty specifications on the
-- canonical component.  Existing values win only when the duplicate is blank.
update public.system_components canonical
set specifications = coalesce(duplicate.specifications, '{}'::jsonb) || coalesce(canonical.specifications, '{}'::jsonb),
    notes = coalesce(nullif(canonical.notes, ''), duplicate.notes),
    manufacturer = coalesce(nullif(canonical.manufacturer, ''), duplicate.manufacturer),
    model = coalesce(nullif(canonical.model, ''), duplicate.model),
    updated_at = greatest(canonical.updated_at, duplicate.updated_at)
from component_entity_merge component_merge
join public.system_components duplicate on duplicate.id = component_merge.duplicate_id
where canonical.id = component_merge.keep_id;

update public.pv_arrays canonical
set specifications = coalesce(duplicate.specifications, '{}'::jsonb) || coalesce(canonical.specifications, '{}'::jsonb),
    panel_watts = coalesce(canonical.panel_watts, duplicate.panel_watts),
    panel_count = coalesce(canonical.panel_count, duplicate.panel_count),
    strings = coalesce(canonical.strings, duplicate.strings),
    panels_per_string = coalesce(canonical.panels_per_string, duplicate.panels_per_string),
    updated_at = greatest(canonical.updated_at, duplicate.updated_at)
from pv_array_entity_merge pv_merge
join public.pv_arrays duplicate on duplicate.id = pv_merge.duplicate_id
where canonical.id = pv_merge.keep_id;

-- Repoint references before deleting duplicate entities.
update public.monitoring_devices device
set mapped_component_id = component_merge.keep_id
from component_entity_merge component_merge
where device.mapped_component_id = component_merge.duplicate_id;

update public.monitoring_devices device
set mapped_pv_array_id = pv_merge.keep_id
from pv_array_entity_merge pv_merge
where device.mapped_pv_array_id = pv_merge.duplicate_id;

-- If both records already have a saved position, keep the canonical record's
-- position so the unique (project_id, node_ref) constraint remains valid.
delete from public.system_schematic_positions position
using component_entity_merge component_merge
where position.node_ref = 'component:' || component_merge.duplicate_id::text
  and exists (
    select 1
    from public.system_schematic_positions canonical_position
    where canonical_position.project_id = position.project_id
      and canonical_position.node_ref = 'component:' || component_merge.keep_id::text
  );

delete from public.system_schematic_positions position
using pv_array_entity_merge pv_merge
where position.node_ref = 'pv:' || pv_merge.duplicate_id::text
  and exists (
    select 1
    from public.system_schematic_positions canonical_position
    where canonical_position.project_id = position.project_id
      and canonical_position.node_ref = 'pv:' || pv_merge.keep_id::text
  );

update public.system_schematic_positions position
set node_ref = 'component:' || component_merge.keep_id::text
from component_entity_merge component_merge
where position.node_ref = 'component:' || component_merge.duplicate_id::text;

update public.system_schematic_positions position
set node_ref = 'pv:' || pv_merge.keep_id::text
from pv_array_entity_merge pv_merge
where position.node_ref = 'pv:' || pv_merge.duplicate_id::text;

-- Repointing two duplicate entities can also collapse two connection rows onto
-- the same named link. Keep the oldest such row before changing its endpoints.
create temporary table connection_entity_merge on commit drop as
with mapped as (
  select
    connection.id,
    connection.project_id,
    connection.name,
    coalesce(
      'component:' || source_component.keep_id::text,
      'pv:' || source_array.keep_id::text,
      connection.source_ref
    ) as mapped_source_ref,
    coalesce(
      'component:' || target_component.keep_id::text,
      'pv:' || target_array.keep_id::text,
      connection.target_ref
    ) as mapped_target_ref,
    connection.created_at
  from public.system_connections connection
  left join component_entity_merge source_component
    on connection.source_ref = 'component:' || source_component.duplicate_id::text
  left join pv_array_entity_merge source_array
    on connection.source_ref = 'pv:' || source_array.duplicate_id::text
  left join component_entity_merge target_component
    on connection.target_ref = 'component:' || target_component.duplicate_id::text
  left join pv_array_entity_merge target_array
    on connection.target_ref = 'pv:' || target_array.duplicate_id::text
), ranked as (
  select
    id,
    first_value(id) over (
      partition by project_id, mapped_source_ref, mapped_target_ref, name
      order by created_at, id
    ) as keep_id,
    row_number() over (
      partition by project_id, mapped_source_ref, mapped_target_ref, name
      order by created_at, id
    ) as duplicate_number
  from mapped
)
select id as duplicate_id, keep_id
from ranked
where duplicate_number > 1;

delete from public.system_connections connection
using connection_entity_merge connection_merge
where connection.id = connection_merge.duplicate_id;

update public.system_connections connection
set source_ref = case
when connection.source_ref = 'component:' || component_merge.duplicate_id::text then 'component:' || component_merge.keep_id::text
      else connection.source_ref
    end,
    target_ref = case
when connection.target_ref = 'component:' || component_merge.duplicate_id::text then 'component:' || component_merge.keep_id::text
      else connection.target_ref
    end
from component_entity_merge component_merge
where connection.source_ref = 'component:' || component_merge.duplicate_id::text
   or connection.target_ref = 'component:' || component_merge.duplicate_id::text;

update public.system_connections connection
set source_ref = case
when connection.source_ref = 'pv:' || pv_merge.duplicate_id::text then 'pv:' || pv_merge.keep_id::text
      else connection.source_ref
    end,
    target_ref = case
when connection.target_ref = 'pv:' || pv_merge.duplicate_id::text then 'pv:' || pv_merge.keep_id::text
      else connection.target_ref
    end
from pv_array_entity_merge pv_merge
where connection.source_ref = 'pv:' || pv_merge.duplicate_id::text
   or connection.target_ref = 'pv:' || pv_merge.duplicate_id::text;

delete from public.system_components component
using component_entity_merge component_merge
where component.id = component_merge.duplicate_id;

delete from public.pv_arrays pv_record
using pv_array_entity_merge pv_merge
where pv_record.id = pv_merge.duplicate_id;

create unique index if not exists system_components_entity_identity_idx
  on public.system_components (
    project_id,
    lower(type),
    lower(display_name),
    lower(coalesce(manufacturer, '')),
    lower(coalesce(model, ''))
  );

create unique index if not exists pv_arrays_entity_identity_idx
  on public.pv_arrays (
    project_id,
    lower(name),
    lower(coalesce(manufacturer, '')),
    lower(coalesce(panel_model, ''))
  );

commit;
