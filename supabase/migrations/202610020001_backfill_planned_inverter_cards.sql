-- Structured discovery proposals can select a multi-inverter arrangement after
-- the user has entered one candidate inverter. Backfill the missing physical
-- technical cards. Each inverter remains a separate quantity-one record.
with planned_projects as (
  select
    project.id as project_id,
    jsonb_array_length(project.settings#>'{designCalculator,inverterPlan,unitRatingsKw}') as planned_count,
    project.settings#>'{designCalculator,inverterPlan,unitRatingsKw}' as ratings
  from public.projects project
  where project.settings->>'schematicOrigin' = 'structured_proposal_intake'
    and jsonb_typeof(project.settings#>'{designCalculator,inverterPlan,unitRatingsKw}') = 'array'
    and jsonb_array_length(project.settings#>'{designCalculator,inverterPlan,unitRatingsKw}') > 1
), ranked_inverters as (
  select
    component.*,
    row_number() over (partition by component.project_id order by component.created_at, component.id) as inverter_number,
    count(*) over (partition by component.project_id) as existing_count
  from public.system_components component
  join planned_projects planned on planned.project_id = component.project_id
  where component.type = 'inverter'
), missing_units as (
  select
    source.*,
    planned.ratings,
    unit_number
  from planned_projects planned
  join ranked_inverters source
    on source.project_id = planned.project_id
   and source.inverter_number = 1
  cross join lateral generate_series(source.existing_count + 1, planned.planned_count) unit_number
)
insert into public.system_components (
  project_id,
  type,
  display_name,
  manufacturer,
  model,
  installation_location,
  quantity,
  specifications,
  notes,
  confidence
)
select
  missing.project_id,
  'inverter',
  case
    when missing.display_name ~* '^inverter( 1)?$' then 'Inverter ' || missing.unit_number
    else missing.display_name || ' ' || missing.unit_number
  end,
  missing.manufacturer,
  missing.model,
  missing.installation_location,
  1,
  coalesce(missing.specifications, '{}'::jsonb)
    || jsonb_build_object(
      'Rated power', (missing.ratings->>((missing.unit_number - 1)::integer)) || ' kW',
      'Equipment record', 'Individual inverter',
      'Planning unit source', 'Wattson inverter plan',
      'Planning unit number', missing.unit_number::text
    ),
  missing.notes,
  missing.confidence
from missing_units missing;
