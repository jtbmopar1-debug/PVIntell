-- Systems created through "Record installed equipment" describe an existing
-- installation. Keep them out of the proposal lifecycle, including records
-- created before that workflow began setting the phase explicitly.

update public.projects
set phase = 'monitor',
    settings = jsonb_set(
      settings,
      '{goal}',
      to_jsonb('Record equipment that is already installed'::text),
      true
    )
where lower(coalesce(settings->>'startingGoal', description, '')) =
      'record equipment that is already installed';
