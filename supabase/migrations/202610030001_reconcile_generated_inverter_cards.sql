-- Remove inverter units that Wattson materialised from an advisory calculation
-- before the user had accepted a multi-unit arrangement. User-entered inverter
-- records are never targeted. Clear the stale advisory plan where a structured
-- proposal already has a user-entered inverter as its authoritative selection.

delete from public.system_connections connection
using public.system_components component, public.projects project
where component.project_id = project.id
  and connection.project_id = project.id
  and component.type = 'inverter'
  and component.specifications->>'Planning unit source' = 'Wattson inverter plan'
  and coalesce(project.settings#>>'{designCalculator,inverterPlan,acceptedByUser}', 'false') <> 'true'
  and (
    connection.source_ref = 'component:' || component.id::text
    or connection.target_ref = 'component:' || component.id::text
  );

delete from public.system_components component
using public.projects project
where component.project_id = project.id
  and component.type = 'inverter'
  and component.specifications->>'Planning unit source' = 'Wattson inverter plan'
  and coalesce(project.settings#>>'{designCalculator,inverterPlan,acceptedByUser}', 'false') <> 'true';

update public.projects project
set settings = project.settings #- '{designCalculator,inverterPlan}'
where project.settings->>'schematicOrigin' = 'structured_proposal_intake'
  and coalesce(project.settings#>>'{designCalculator,inverterPlan,acceptedByUser}', 'false') <> 'true'
  and exists (
    select 1
    from public.system_components component
    where component.project_id = project.id
      and component.type = 'inverter'
      and component.specifications->>'Planning unit source' is distinct from 'Wattson inverter plan'
  );
