-- Keep one typed, versioned state document on the conversation itself. Message
-- structured_context remains an immutable evidence/result audit trail and is no
-- longer the workflow state machine.
alter table public.user_conversations
  add column if not exists conversation_state jsonb not null default '{"version":1,"revision":0,"activeIntent":"general","evidence":[],"facts":[],"corrections":[],"questions":[],"completedActions":[]}'::jsonb;

alter table public.conversations
  add column if not exists conversation_state jsonb not null default '{"version":1,"revision":0,"activeIntent":"general","evidence":[],"facts":[],"corrections":[],"questions":[],"completedActions":[]}'::jsonb;

comment on column public.user_conversations.conversation_state is
  'Authoritative Wattson intent, facts, evidence, corrections, questions and pending action state.';
comment on column public.conversations.conversation_state is
  'Authoritative Wattson intent, facts, evidence, corrections, questions and pending action state.';

-- A client-generated request id makes retries safe after a timeout: the same
-- user turn and its reply can be found instead of applying actions twice.
alter table public.user_chat_messages
  add column if not exists client_request_id uuid,
  add column if not exists response_to_request_id uuid;
alter table public.chat_messages
  add column if not exists client_request_id uuid,
  add column if not exists response_to_request_id uuid;

create unique index if not exists user_chat_messages_request_once_idx
  on public.user_chat_messages(client_request_id)
  where client_request_id is not null;
create unique index if not exists user_chat_messages_response_once_idx
  on public.user_chat_messages(response_to_request_id)
  where response_to_request_id is not null;
create unique index if not exists chat_messages_request_once_idx
  on public.chat_messages(client_request_id)
  where client_request_id is not null;
create unique index if not exists chat_messages_response_once_idx
  on public.chat_messages(response_to_request_id)
  where response_to_request_id is not null;
