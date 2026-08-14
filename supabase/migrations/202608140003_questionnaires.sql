-- Versioned, autosaved fact collection for each energy system.

create table public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  template_key text not null,
  template_version integer not null default 1 check (template_version > 0),
  status text not null default 'draft' check (status in ('draft', 'completed')),
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, template_key)
);

create index questionnaire_responses_project_idx
  on public.questionnaire_responses(project_id);

create trigger questionnaire_responses_set_updated_at
before update on public.questionnaire_responses
for each row execute function public.set_updated_at();

alter table public.questionnaire_responses enable row level security;

create policy "questionnaire_responses_owner_all"
on public.questionnaire_responses
for all to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

