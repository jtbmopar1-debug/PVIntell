-- Migration 053 may already have been applied before authenticated shadow
-- logging was added. Install the owner-scoped recorder independently so every
-- user-facing Wattson route can write usage without access to the ledger.
create or replace function public.record_own_wattson_credit_usage(
  usage_action_key text,
  usage_site_id uuid default null,
  usage_project_id uuid default null,
  usage_idempotency_key text default null,
  usage_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  usage_owner_id uuid := auth.uid();
  usage_credits integer;
begin
  if usage_owner_id is null then raise exception 'Authentication required'; end if;
  usage_credits := case usage_action_key
    when 'system_proposal' then 20
    when 'proposal_rebuild' then 6
    when 'captured_component' then 1
    when 'monitoring_connection' then 5
    when 'handover_review' then 2
    when 'image_analysis' then 2
    when 'wattson_reply' then 1
    else null
  end;
  if usage_credits is null then raise exception 'Unknown Wattson Credit action'; end if;
  if usage_site_id is not null and not exists (
    select 1 from public.sites where id = usage_site_id and owner_id = usage_owner_id
  ) then raise exception 'Site not found'; end if;
  if usage_project_id is not null and not exists (
    select 1 from public.projects where id = usage_project_id and owner_id = usage_owner_id
  ) then raise exception 'Power system not found'; end if;

  insert into public.wattson_credit_usage (
    owner_id, site_id, project_id, action_key, proposed_credits, idempotency_key, metadata
  ) values (
    usage_owner_id, usage_site_id, usage_project_id, usage_action_key,
    usage_credits, usage_idempotency_key, coalesce(usage_metadata, '{}'::jsonb)
  ) on conflict (owner_id, idempotency_key) where idempotency_key is not null do nothing;
end;
$$;

revoke all on function public.record_own_wattson_credit_usage(text, uuid, uuid, text, jsonb) from public;
grant execute on function public.record_own_wattson_credit_usage(text, uuid, uuid, text, jsonb) to authenticated;
