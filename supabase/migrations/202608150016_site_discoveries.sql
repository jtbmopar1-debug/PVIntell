-- One combined Site + System discovery brief per independent Site workspace.
-- A Site may share a street address with another Site, but never shares its brief.

create table public.site_discoveries (
  site_id uuid primary key references public.sites(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  question_id text,
  answers jsonb not null default '{}'::jsonb,
  baseline_answers jsonb,
  impact_pending boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index site_discoveries_owner_id_idx on public.site_discoveries(owner_id);
create index site_discoveries_impact_pending_idx on public.site_discoveries(owner_id, impact_pending) where impact_pending;

-- Preserve briefs saved by the initial JSON-based implementation.
insert into public.site_discoveries (
  site_id, owner_id, status, question_id, answers, baseline_answers, impact_pending, completed_at, updated_at
)
select
  s.id,
  s.owner_id,
  coalesce(s.settings->'discovery'->>'status', 'draft'),
  s.settings->'discovery'->>'questionId',
  coalesce(s.settings->'discovery'->'answers', '{}'::jsonb),
  coalesce(s.settings->'discovery'->'baselineAnswers', case when s.settings->'discovery'->>'status' = 'completed' then s.settings->'discovery'->'answers' end),
  coalesce((s.settings->'discovery'->>'impactPending')::boolean, false),
  case when s.settings->'discovery'->>'status' = 'completed' then coalesce((s.settings->'discovery'->>'updatedAt')::timestamptz, now()) end,
  coalesce((s.settings->'discovery'->>'updatedAt')::timestamptz, now())
from public.sites s
where s.settings ? 'discovery'
on conflict (site_id) do nothing;

create trigger site_discoveries_set_updated_at
before update on public.site_discoveries
for each row execute function public.set_updated_at();

alter table public.site_discoveries enable row level security;

create policy "site_discoveries_owner_all" on public.site_discoveries
for all to authenticated
using (owner_id = (select auth.uid()) and public.owns_site(site_id))
with check (owner_id = (select auth.uid()) and public.owns_site(site_id));
