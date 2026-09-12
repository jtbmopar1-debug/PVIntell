-- Delete discovery/system workspaces as complete units. Previously the API
-- deleted only a discovery_drafts or projects row, which left its grouped
-- conversation or an empty parent Site behind.

create or replace function public.delete_discovery_draft_workspace(target_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid := auth.uid();
  linked_conversation_id uuid;
begin
  if acting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select conversation_id
  into linked_conversation_id
  from public.discovery_drafts
  where id = target_draft_id and owner_id = acting_user_id
  for update;

  if not found then
    return jsonb_build_object('deleted', false);
  end if;

  delete from public.discovery_drafts
  where id = target_draft_id and owner_id = acting_user_id;

  if linked_conversation_id is not null then
    delete from public.user_conversations
    where id = linked_conversation_id and owner_id = acting_user_id;
  end if;

  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.delete_site_workspace(target_site_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid := auth.uid();
  draft_conversation_ids uuid[];
  assessment jsonb;
begin
  if acting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.sites
  where id = target_site_id and owner_id = acting_user_id
  for update;

  if not found then
    return jsonb_build_object('deleted', false);
  end if;

  select coalesce(array_agg(conversation_id) filter (where conversation_id is not null), '{}'::uuid[])
  into draft_conversation_ids
  from public.discovery_drafts
  where owner_id = acting_user_id
    and answers ->> 'site_id' = target_site_id::text;

  delete from public.discovery_drafts
  where owner_id = acting_user_id
    and answers ->> 'site_id' = target_site_id::text;

  delete from public.user_conversations
  where owner_id = acting_user_id
    and id = any(draft_conversation_ids);

  select coalesce(onboarding_assessment, '{}'::jsonb)
  into assessment
  from public.profiles
  where id = acting_user_id
  for update;

  if assessment #>> '{lastGuidedDiscovery,siteId}' = target_site_id::text then
    assessment := assessment - 'lastGuidedDiscovery';
  end if;
  if assessment #>> '{guidedNewSystem,answers,site_id}' = target_site_id::text then
    assessment := assessment - 'guidedNewSystem';
  end if;

  update public.profiles
  set onboarding_assessment = assessment
  where id = acting_user_id;

  -- Project, equipment, monitoring and Site-linked conversation rows cascade.
  delete from public.sites
  where id = target_site_id and owner_id = acting_user_id;

  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.delete_system_workspace(target_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user_id uuid := auth.uid();
  parent_site_id uuid;
  assessment jsonb;
  removed_site boolean := false;
begin
  if acting_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select site_id
  into parent_site_id
  from public.projects
  where id = target_project_id and owner_id = acting_user_id
  for update;

  if not found then
    return jsonb_build_object('deleted', false, 'siteDeleted', false);
  end if;

  -- Serialize deletion against another system being added to this Site.
  perform 1 from public.sites
  where id = parent_site_id and owner_id = acting_user_id
  for update;

  delete from public.projects
  where id = target_project_id and owner_id = acting_user_id;

  select coalesce(onboarding_assessment, '{}'::jsonb)
  into assessment
  from public.profiles
  where id = acting_user_id
  for update;

  if assessment #>> '{lastGuidedDiscovery,systemId}' = target_project_id::text then
    assessment := assessment - 'lastGuidedDiscovery';
    update public.profiles
    set onboarding_assessment = assessment
    where id = acting_user_id;
  end if;

  if not exists (select 1 from public.projects where site_id = parent_site_id) then
    perform public.delete_site_workspace(parent_site_id);
    removed_site := true;
  end if;

  return jsonb_build_object('deleted', true, 'siteDeleted', removed_site);
end;
$$;

revoke all on function public.delete_discovery_draft_workspace(uuid) from public;
revoke all on function public.delete_site_workspace(uuid) from public;
revoke all on function public.delete_system_workspace(uuid) from public;
grant execute on function public.delete_discovery_draft_workspace(uuid) to authenticated;
grant execute on function public.delete_site_workspace(uuid) to authenticated;
grant execute on function public.delete_system_workspace(uuid) to authenticated;

-- Sites are only created alongside a system in the application. Any existing
-- Site with no projects is residue from the old project-only deletion path.
do $$
declare
  orphan_site record;
  orphan_conversation_ids uuid[];
  orphan_assessment jsonb;
begin
  for orphan_site in
    select site.id, site.owner_id
    from public.sites site
    where not exists (select 1 from public.projects project where project.site_id = site.id)
  loop
    select coalesce(array_agg(conversation_id) filter (where conversation_id is not null), '{}'::uuid[])
    into orphan_conversation_ids
    from public.discovery_drafts
    where owner_id = orphan_site.owner_id
      and answers ->> 'site_id' = orphan_site.id::text;

    delete from public.discovery_drafts
    where owner_id = orphan_site.owner_id
      and answers ->> 'site_id' = orphan_site.id::text;

    delete from public.user_conversations
    where owner_id = orphan_site.owner_id
      and id = any(orphan_conversation_ids);

    select coalesce(onboarding_assessment, '{}'::jsonb)
    into orphan_assessment
    from public.profiles
    where id = orphan_site.owner_id;

    if orphan_assessment #>> '{lastGuidedDiscovery,siteId}' = orphan_site.id::text then
      orphan_assessment := orphan_assessment - 'lastGuidedDiscovery';
    end if;
    if orphan_assessment #>> '{guidedNewSystem,answers,site_id}' = orphan_site.id::text then
      orphan_assessment := orphan_assessment - 'guidedNewSystem';
    end if;

    update public.profiles
    set onboarding_assessment = orphan_assessment
    where id = orphan_site.owner_id;

    delete from public.sites where id = orphan_site.id;
  end loop;
end;
$$;
