-- Removing proposal-intake equipment must also remove the saved connection
-- records that point at it. The refs are text rather than foreign keys, so the
-- database cannot cascade this cleanup automatically.
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
  if not public.owns_project(target_project_id) then
    raise exception 'Power system not found';
  end if;

  delete from public.system_connections connection
  where connection.project_id = target_project_id
    and (
      exists (
        select 1
        from public.pv_arrays array_record
        where array_record.project_id = target_project_id
          and (
            connection.source_ref = 'pv:' || array_record.id::text
            or connection.target_ref = 'pv:' || array_record.id::text
          )
      )
      or exists (
        select 1
        from public.system_components component
        where component.project_id = target_project_id
          and component.type in ('inverter', 'battery', 'generator')
          and (
            connection.source_ref = 'component:' || component.id::text
            or connection.target_ref = 'component:' || component.id::text
          )
      )
    );

  delete from public.pv_arrays
  where project_id = target_project_id;

  delete from public.system_components
  where project_id = target_project_id
    and type in ('inverter', 'battery', 'generator');

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
