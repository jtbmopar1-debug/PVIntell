-- Keep each user's retained Wattson history bounded. The application checks
-- across both conversation scopes before creation; these indexes keep those
-- ownership and recency checks inexpensive.
create index if not exists user_conversations_owner_updated_idx
  on public.user_conversations(owner_id, updated_at desc);

create index if not exists conversations_project_updated_idx
  on public.conversations(project_id, updated_at desc);

comment on table public.user_conversations is
  'User-level Wattson history. PVIntell currently permits 25 retained conversations per user across user and project scopes.';

create or replace function public.touch_wattson_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'user_chat_messages' then
    update public.user_conversations set updated_at = now() where id = new.conversation_id;
  else
    update public.conversations set updated_at = now() where id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists user_chat_messages_touch_conversation on public.user_chat_messages;
create trigger user_chat_messages_touch_conversation after insert on public.user_chat_messages
for each row execute function public.touch_wattson_conversation();

drop trigger if exists chat_messages_touch_conversation on public.chat_messages;
create trigger chat_messages_touch_conversation after insert on public.chat_messages
for each row execute function public.touch_wattson_conversation();
