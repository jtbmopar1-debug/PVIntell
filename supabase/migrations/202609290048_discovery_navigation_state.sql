-- A project-backed discovery needs the same durable resume position as a
-- pre-project draft. Without this, refreshes can reopen an earlier question.
alter table public.questionnaire_responses
  add column if not exists question_id text;

-- Removing proposal-intake equipment is one user-confirmed operation. Keep
-- the equipment deletion and questionnaire update in one database transaction.
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
grant execute on function public.save_discovery_without_proposed_equipment(uuid, jsonb, text) to authenticated;
