-- Discovery help is one conversation per build. Fold older per-section and
-- review conversations into the first discovery thread for the same system.

update public.user_conversations conversation
set site_id = project.site_id,
    project_id = project.id
from public.projects project
where conversation.owner_id = project.owner_id
  and conversation.project_id is null
  and lower(coalesce(conversation.title, '')) like '%discovery%'
  and lower(regexp_replace(coalesce(conversation.title, ''),
    '(^discovery[[:space:]]*[—-][[:space:]]*|[[:space:]]*[—-][[:space:]]*discovery review$)',
    '', 'gi')) = lower(project.name);

with ranked as (
  select id,
         first_value(id) over (
           partition by owner_id, coalesce(project_id::text, 'site:' || site_id::text)
           order by created_at, id
         ) as keeper_id,
         row_number() over (
           partition by owner_id, coalesce(project_id::text, 'site:' || site_id::text)
           order by created_at, id
         ) as position
  from public.user_conversations
  where (project_id is not null or site_id is not null)
    and lower(coalesce(title, '')) like '%discovery%'
), moved as (
  update public.user_chat_messages message
  set conversation_id = ranked.keeper_id
  from ranked
  where ranked.position > 1
    and message.conversation_id = ranked.id
  returning ranked.id
)
delete from public.user_conversations conversation
using ranked
where ranked.position > 1
  and conversation.id = ranked.id;

update public.user_conversations conversation
set title = 'Discovery — ' || project.name,
    site_id = project.site_id
from public.projects project
where conversation.project_id = project.id
  and conversation.owner_id = project.owner_id
  and lower(coalesce(conversation.title, '')) like '%discovery%';
