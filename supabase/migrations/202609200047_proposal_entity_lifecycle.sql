-- Component identity is the row id. Names, manufacturers and models are
-- editable specifications and cannot safely be used as entity identity.
drop index if exists public.system_components_entity_identity_idx;
drop index if exists public.pv_arrays_entity_identity_idx;

-- Proposal editing previously promoted records to confirmed. Restore proposal
-- records to estimated without changing records belonging to captured or
-- commissioned systems.
update public.system_components component
set confidence = 'estimated'
from public.projects project
where component.project_id = project.id
  and component.confidence = 'confirmed'
  and project.phase in ('discover', 'design')
  and (
    project.settings->>'systemStatus' in ('discovery', 'proposed')
    or project.settings->>'workflowOrigin' in ('discovery', 'proposed-plan')
    or project.settings->>'schematicOrigin' in ('structured_proposal_intake', 'wattson_proposal')
  );

update public.pv_arrays array_record
set confidence = 'estimated'
from public.projects project
where array_record.project_id = project.id
  and array_record.confidence = 'confirmed'
  and project.phase in ('discover', 'design')
  and (
    project.settings->>'systemStatus' in ('discovery', 'proposed')
    or project.settings->>'workflowOrigin' in ('discovery', 'proposed-plan')
    or project.settings->>'schematicOrigin' in ('structured_proposal_intake', 'wattson_proposal')
  );
