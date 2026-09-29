-- Handover must never promote questionnaire completion without the accepted
-- proposal topology. An earlier flow saved proposal equipment but could omit
-- its connections, allowing an incomplete build to appear commissioned.

drop table if exists pg_temp.broken_structured_handover_projects;

create temporary table broken_structured_handover_projects on commit drop as
select project.id
from public.projects project
where project.phase = 'monitor'
  and project.settings->>'schematicOrigin' = 'structured_proposal_intake'
  and project.settings#>>'{designCalculator,proposedChecklist,proposed-schematic}' = 'true'
  and (
    exists (
      select 1
      from jsonb_array_elements(coalesce(project.settings#>'{designCalculator,proposedAsBuiltDraft,nodes}', '[]'::jsonb)) node
      where coalesce((node->>'authorityCheck')::boolean, false) = false
        and (
          coalesce((node->>'reviewed')::boolean, false) = false
          or nullif(node->>'recordRef', '') is null
          or not exists (
            select 1
            from public.system_components component
            where component.project_id = project.id
              and ('component:' || component.id::text) = (node->>'recordRef')
            union all
            select 1
            from public.pv_arrays pv_array
            where pv_array.project_id = project.id
              and ('pv:' || pv_array.id::text) = (node->>'recordRef')
          )
          or not exists (
            select 1
            from jsonb_array_elements(coalesce(project.settings#>'{designCalculator,proposedAsBuiltDraft,connections}', '[]'::jsonb)) connection
            where coalesce((connection->>'authorityCheck')::boolean, false) = false
              and (connection->>'from' = node->>'id' or connection->>'to' = node->>'id')
          )
        )
    )
    or exists (
      select 1
      from jsonb_array_elements(coalesce(project.settings#>'{designCalculator,proposedAsBuiltDraft,connections}', '[]'::jsonb)) connection
      left join lateral (
        select node->>'recordRef' as record_ref
        from jsonb_array_elements(coalesce(project.settings#>'{designCalculator,proposedAsBuiltDraft,nodes}', '[]'::jsonb)) node
        where node->>'id' = connection->>'from'
        limit 1
      ) source_node on true
      left join lateral (
        select node->>'recordRef' as record_ref
        from jsonb_array_elements(coalesce(project.settings#>'{designCalculator,proposedAsBuiltDraft,nodes}', '[]'::jsonb)) node
        where node->>'id' = connection->>'to'
        limit 1
      ) target_node on true
      where coalesce((connection->>'authorityCheck')::boolean, false) = false
        and (
          coalesce((connection->>'configured')::boolean, false) = false
          or nullif(source_node.record_ref, '') is null
          or nullif(target_node.record_ref, '') is null
          or not exists (
            select 1
            from public.system_connections saved
            where saved.project_id = project.id
              and (
                (saved.source_ref = source_node.record_ref and saved.target_ref = target_node.record_ref)
                or (saved.source_ref = target_node.record_ref and saved.target_ref = source_node.record_ref)
              )
              and saved.connection_type = case
                when connection->>'kind' in ('solar-dc', 'battery-dc') then 'dc'
                else connection->>'kind'
              end
          )
        )
    )
  );

-- Affected records are unfinished builds, not installed systems. Preserve the
-- proposal, repair its saved topology below, and require Build/Handover again.
update public.projects
set phase = 'build'
where id in (select id from broken_structured_handover_projects);

update public.system_build_modules
set complete = false,
    completed_at = null
where project_id in (select id from broken_structured_handover_projects);

update public.system_handover_modules
set screening_answers = '{}'::jsonb,
    complete = false,
    review_status = 'unreviewed',
    review_summary = null,
    review_findings = '[]'::jsonb,
    reviewed_at = null
where project_id in (select id from broken_structured_handover_projects);

update public.system_components
set confidence = 'estimated'
where project_id in (select id from broken_structured_handover_projects)
  and specifications->>'Proposal source' = 'Wattson design';

update public.pv_arrays
set confidence = 'estimated'
where project_id in (select id from broken_structured_handover_projects)
  and specifications->>'Proposal source' = 'Wattson design';

update public.system_connections
set confidence = 'estimated'
where project_id in (select id from broken_structured_handover_projects);

-- Older databases may still enforce one unnamed circuit per endpoint pair.
-- The accepted proposal can legitimately contain parallel named circuits.
alter table public.system_connections
  drop constraint if exists system_connections_unique_link;

-- Remove only exact duplicate named links. Keep the confirmed row first, then
-- the row carrying the most recorded cable/protection detail.
with ranked_connections as (
  select
    connection.id,
    row_number() over (
      partition by connection.project_id, connection.source_ref, connection.target_ref, connection.name
      order by
        case when connection.confidence = 'confirmed' then 0 else 1 end,
        num_nonnulls(
          connection.cable_size,
          connection.cable_length,
          connection.breaker_size,
          connection.fuse_size,
          connection.isolator,
          connection.route,
          nullif(connection.notes, '')
        ) desc,
        length(coalesce(connection.notes, '')) desc,
        connection.updated_at desc,
        connection.created_at,
        connection.id
    ) as duplicate_number
  from public.system_connections connection
)
delete from public.system_connections connection
using ranked_connections ranked
where connection.id = ranked.id
  and ranked.duplicate_number > 1;

alter table public.system_connections
  add constraint system_connections_unique_link
    unique (project_id, source_ref, target_ref, name);

insert into public.system_connections (
  project_id,
  source_ref,
  target_ref,
  name,
  connection_type,
  circuit_role,
  polarity,
  cable_size,
  cable_length,
  breaker_size,
  notes,
  confidence
)
select
  project.id,
  source_node.record_ref,
  target_node.record_ref,
  connection->>'label',
  case when connection->>'kind' in ('solar-dc', 'battery-dc') then 'dc' else connection->>'kind' end,
  case when connection->>'kind' = 'solar-dc' then 'pv_dc'
       when connection->>'kind' = 'battery-dc' then 'battery_dc'
       else 'unspecified' end,
  case when connection->>'kind' in ('solar-dc', 'battery-dc') then 'pair' else 'na' end,
  case when nullif(connection->>'cableSizeMm2', '') is not null then (connection->>'cableSizeMm2') || ' mm²' end,
  case when nullif(connection->>'lengthM', '') is not null then (connection->>'lengthM') || ' m' end,
  case when nullif(connection->>'protectionAmps', '') is not null then (connection->>'protectionAmps') || ' A' end,
  concat_ws(E'\n', nullif(connection->>'notes', ''), '[proposal-connection:' || (connection->>'from') || ':' || (connection->>'to') || ':' || (connection->>'kind') || ']'),
  'estimated'::public.confidence
from public.projects project
cross join lateral jsonb_array_elements(coalesce(project.settings#>'{designCalculator,proposedAsBuiltDraft,connections}', '[]'::jsonb)) connection
join lateral (
  select node->>'recordRef' as record_ref
  from jsonb_array_elements(coalesce(project.settings#>'{designCalculator,proposedAsBuiltDraft,nodes}', '[]'::jsonb)) node
  where node->>'id' = connection->>'from'
  limit 1
) source_node on nullif(source_node.record_ref, '') is not null
join lateral (
  select node->>'recordRef' as record_ref
  from jsonb_array_elements(coalesce(project.settings#>'{designCalculator,proposedAsBuiltDraft,nodes}', '[]'::jsonb)) node
  where node->>'id' = connection->>'to'
  limit 1
) target_node on nullif(target_node.record_ref, '') is not null
where project.settings->>'schematicOrigin' = 'structured_proposal_intake'
  and project.phase in ('design', 'build', 'commission', 'monitor')
  and coalesce((connection->>'authorityCheck')::boolean, false) = false
  and source_node.record_ref <> target_node.record_ref
  and not exists (
    select 1
    from public.system_connections saved
    where saved.project_id = project.id
      and saved.name = connection->>'label'
      and (
        (saved.source_ref = source_node.record_ref and saved.target_ref = target_node.record_ref)
        or (saved.source_ref = target_node.record_ref and saved.target_ref = source_node.record_ref)
      )
  )
on conflict (project_id, source_ref, target_ref, name) do update
set connection_type = excluded.connection_type,
    circuit_role = excluded.circuit_role,
    polarity = excluded.polarity,
    cable_size = excluded.cable_size,
    cable_length = excluded.cable_length,
    breaker_size = excluded.breaker_size,
    notes = excluded.notes,
    confidence = 'estimated';

create or replace function public.complete_system_handover(
  target_project_id uuid,
  required_modules text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  project_settings jsonb;
begin
  select project.settings into project_settings
  from public.projects project
  where project.id = target_project_id
    and project.owner_id = (select auth.uid())
    and project.phase in ('design', 'build', 'commission');

  if project_settings is null then
    raise exception 'Unfinished build not found';
  end if;

  if project_settings#>>'{designCalculator,proposedChecklist,proposed-schematic}' <> 'true' then
    raise exception 'Accept the completed schematic before finishing handover';
  end if;

  if cardinality(required_modules) = 0
    or not required_modules <@ array['pv-array', 'pv-dc', 'battery', 'inverter', 'ac', 'generator', 'earthing']::text[]
  then
    raise exception 'The accepted design does not contain a valid build plan';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(project_settings#>'{designCalculator,proposedAsBuiltDraft,nodes}', '[]'::jsonb)) node
    where coalesce((node->>'authorityCheck')::boolean, false) = false
      and (
        coalesce((node->>'reviewed')::boolean, false) = false
        or nullif(node->>'recordRef', '') is null
        or not exists (
          select 1 from public.system_components component
          where component.project_id = target_project_id and ('component:' || component.id::text) = (node->>'recordRef')
          union all
          select 1 from public.pv_arrays pv_array
          where pv_array.project_id = target_project_id and ('pv:' || pv_array.id::text) = (node->>'recordRef')
        )
        or not exists (
          select 1
          from jsonb_array_elements(coalesce(project_settings#>'{designCalculator,proposedAsBuiltDraft,connections}', '[]'::jsonb)) connection
          where coalesce((connection->>'authorityCheck')::boolean, false) = false
            and (connection->>'from' = node->>'id' or connection->>'to' = node->>'id')
        )
      )
  ) then
    raise exception 'The accepted schematic still contains unaccepted, missing or disconnected equipment';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(project_settings#>'{designCalculator,proposedAsBuiltDraft,connections}', '[]'::jsonb)) connection
    left join lateral (
      select node->>'recordRef' as record_ref
      from jsonb_array_elements(coalesce(project_settings#>'{designCalculator,proposedAsBuiltDraft,nodes}', '[]'::jsonb)) node
      where node->>'id' = connection->>'from'
      limit 1
    ) source_node on true
    left join lateral (
      select node->>'recordRef' as record_ref
      from jsonb_array_elements(coalesce(project_settings#>'{designCalculator,proposedAsBuiltDraft,nodes}', '[]'::jsonb)) node
      where node->>'id' = connection->>'to'
      limit 1
    ) target_node on true
    where coalesce((connection->>'authorityCheck')::boolean, false) = false
      and (
        coalesce((connection->>'configured')::boolean, false) = false
        or nullif(source_node.record_ref, '') is null
        or nullif(target_node.record_ref, '') is null
        or not exists (
          select 1
          from public.system_connections saved
          where saved.project_id = target_project_id
            and (
              (saved.source_ref = source_node.record_ref and saved.target_ref = target_node.record_ref)
              or (saved.source_ref = target_node.record_ref and saved.target_ref = source_node.record_ref)
            )
            and saved.connection_type = case
              when connection->>'kind' in ('solar-dc', 'battery-dc') then 'dc'
              else connection->>'kind'
            end
        )
      )
  ) then
    raise exception 'The accepted schematic still contains unconfigured or unsaved connections';
  end if;

  if exists (
    select 1
    from unnest(required_modules) as required(module_id)
    where not exists (
      select 1
      from public.system_build_modules build_module
      where build_module.project_id = target_project_id
        and build_module.module_id = required.module_id
        and build_module.complete
    )
  ) then
    raise exception 'Complete every Build It module first';
  end if;

  if exists (
    select 1
    from unnest(required_modules) as required(module_id)
    where not exists (
      select 1
      from public.system_handover_modules handover_module
      where handover_module.project_id = target_project_id
        and handover_module.module_id = required.module_id
        and handover_module.complete
        and handover_module.review_status in ('ready', 'needs_attention')
    )
  ) then
    raise exception 'Complete Wattson review for every handover module first';
  end if;

  update public.system_components set confidence = 'confirmed' where project_id = target_project_id;
  update public.pv_arrays set confidence = 'confirmed' where project_id = target_project_id;
  update public.system_connections set confidence = 'confirmed' where project_id = target_project_id;
  update public.projects set phase = 'monitor' where id = target_project_id;
end;
$$;

revoke all on function public.complete_system_handover(uuid, text[]) from public;
grant execute on function public.complete_system_handover(uuid, text[]) to authenticated;
