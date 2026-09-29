-- Leaving proposal intake means discarding that proposed design as one
-- user-confirmed operation. Connections use text refs rather than foreign keys,
-- so the database cannot cascade this cleanup automatically.
create or replace function public.save_discovery_without_proposed_equipment(
  target_project_id uuid,
  next_answers jsonb,
  next_question_id text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.projects project
    where project.id = target_project_id
      and project.owner_id = (select auth.uid())
      and project.phase in ('discover', 'design')
      and project.settings->>'workflowOrigin' = 'discovery'
      and project.settings->>'schematicOrigin' = 'structured_proposal_intake'
  ) then
    raise exception 'Power system not found';
  end if;

  -- Every connection in this guarded workspace belongs to the proposal being
  -- discarded, including links between generated protection and board nodes.
  delete from public.system_connections
  where project_id = target_project_id;

  delete from public.pv_arrays
  where project_id = target_project_id;

  delete from public.system_components
  where project_id = target_project_id;

  update public.projects
  set phase = 'discover',
      settings = settings
        - 'designCalculator'
        - 'designPreferences'
        - 'designDiscovery'
  where id = target_project_id;

  insert into public.questionnaire_responses (
    project_id,
    template_key,
    template_version,
    status,
    question_id,
    answers
  ) values (
    target_project_id,
    'guided_new_system',
    1,
    'draft',
    next_question_id,
    next_answers
  )
  on conflict (project_id, template_key) do update
  set status = 'draft',
      question_id = excluded.question_id,
      answers = excluded.answers,
      completed_at = null;
end;
$$;

revoke all on function public.save_discovery_without_proposed_equipment(uuid, jsonb, text) from public;
grant execute on function public.save_discovery_without_proposed_equipment(uuid, jsonb, text) to authenticated;
