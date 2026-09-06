-- Independent pre-system discovery drafts. Keeping these separate from profiles
-- allows several builds to be explored at once and gives subscriptions a clean
-- place to enforce future draft allowances.

create table public.discovery_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'review_needed')),
  question_id text,
  conversation_id uuid references public.user_conversations(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index discovery_drafts_owner_updated_idx
  on public.discovery_drafts(owner_id, updated_at desc);

create trigger discovery_drafts_set_updated_at
before update on public.discovery_drafts
for each row execute function public.set_updated_at();

alter table public.discovery_drafts enable row level security;

create policy "discovery_drafts_owner_all" on public.discovery_drafts
for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
