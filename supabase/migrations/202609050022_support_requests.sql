-- Minimal delivery records let the support endpoint enforce a per-user limit
-- without keeping a second copy of the user's support message in PVIntell.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  resend_email_id text,
  created_at timestamptz not null default now()
);

create index if not exists support_requests_owner_created_idx
  on public.support_requests(owner_id, created_at desc);

alter table public.support_requests enable row level security;

drop policy if exists "Users can read their support delivery records" on public.support_requests;
create policy "Users can read their support delivery records"
  on public.support_requests for select
  using (auth.uid() = owner_id);

drop policy if exists "Users can create their support delivery records" on public.support_requests;
create policy "Users can create their support delivery records"
  on public.support_requests for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update their support delivery records" on public.support_requests;
create policy "Users can update their support delivery records"
  on public.support_requests for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

comment on table public.support_requests is
  'Minimal Resend delivery and rate-limit records. Support message bodies are not duplicated here.';
