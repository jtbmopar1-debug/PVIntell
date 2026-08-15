-- User-level onboarding and Wattson conversations that exist before a site/system.

alter table public.profiles
  add column if not exists timezone text not null default 'UTC',
  add column if not exists home_location text,
  add column if not exists onboarding_status text not null default 'pending'
    check (onboarding_status in ('pending', 'in_progress', 'completed')),
  add column if not exists onboarding_assessment jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_completed_at timestamptz;

create table if not exists public.user_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Wattson dashboard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_conversations_owner_idx
  on public.user_conversations(owner_id, created_at);

create table if not exists public.user_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.user_conversations(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  structured_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_chat_messages_conversation_idx
  on public.user_chat_messages(conversation_id, created_at);

alter table public.user_conversations enable row level security;
alter table public.user_chat_messages enable row level security;

create policy "user_conversations_owner_all"
on public.user_conversations for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "user_chat_messages_owner_all"
on public.user_chat_messages for all to authenticated
using (
  exists (
    select 1 from public.user_conversations conversation
    where conversation.id = user_chat_messages.conversation_id
      and conversation.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.user_conversations conversation
    where conversation.id = user_chat_messages.conversation_id
      and conversation.owner_id = (select auth.uid())
  )
);
