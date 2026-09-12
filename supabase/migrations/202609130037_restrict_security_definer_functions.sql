-- Keep elevated trigger execution internal and remove unnecessary SECURITY
-- DEFINER from owner-scoped helpers/RPCs. SECURITY INVOKER makes the caller's
-- existing RLS permissions the final authority.

alter function public.delete_discovery_draft_workspace(uuid) security invoker;
alter function public.delete_site_workspace(uuid) security invoker;
alter function public.delete_system_workspace(uuid) security invoker;
alter function public.owns_project(uuid) security invoker;
alter function public.owns_site(uuid) security invoker;
alter function public.owns_monitoring_scope(uuid, uuid, uuid) security invoker;
alter function public.touch_wattson_conversation() security invoker;

revoke all on function public.delete_discovery_draft_workspace(uuid) from public, anon, authenticated;
revoke all on function public.delete_site_workspace(uuid) from public, anon, authenticated;
revoke all on function public.delete_system_workspace(uuid) from public, anon, authenticated;
revoke all on function public.owns_project(uuid) from public, anon, authenticated;
revoke all on function public.owns_site(uuid) from public, anon, authenticated;
revoke all on function public.owns_monitoring_scope(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.touch_wattson_conversation() from public, anon, authenticated;

grant execute on function public.delete_discovery_draft_workspace(uuid) to authenticated;
grant execute on function public.delete_site_workspace(uuid) to authenticated;
grant execute on function public.delete_system_workspace(uuid) to authenticated;
grant execute on function public.owns_project(uuid) to authenticated;
grant execute on function public.owns_site(uuid) to authenticated;
grant execute on function public.owns_monitoring_scope(uuid, uuid, uuid) to authenticated;

-- The auth.users trigger requires elevated access to create the matching
-- profile, but it is never an application RPC. Trigger execution remains valid
-- without exposing direct EXECUTE to API roles.
revoke all on function public.handle_new_user() from public, anon, authenticated;

