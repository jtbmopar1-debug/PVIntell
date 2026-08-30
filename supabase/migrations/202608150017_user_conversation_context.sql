-- A Wattson conversation may belong to a Site and its proposed power system.
alter table public.user_conversations
  add column if not exists site_id uuid references public.sites(id) on delete cascade,
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

create index if not exists user_conversations_site_idx
  on public.user_conversations(owner_id, site_id, created_at desc);
create index if not exists user_conversations_project_idx
  on public.user_conversations(owner_id, project_id, created_at desc);
