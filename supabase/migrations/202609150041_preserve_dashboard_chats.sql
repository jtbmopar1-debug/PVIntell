-- Dashboard Wattson conversations can create and later link to a Site/system,
-- but they remain user-owned history. Removing a test or obsolete workspace
-- must not also erase the conversation that described it.
alter table public.user_conversations
  drop constraint if exists user_conversations_project_id_fkey,
  add constraint user_conversations_project_id_fkey
    foreign key (project_id) references public.projects(id) on delete set null;

alter table public.user_conversations
  drop constraint if exists user_conversations_site_id_fkey,
  add constraint user_conversations_site_id_fkey
    foreign key (site_id) references public.sites(id) on delete set null;

comment on column public.user_conversations.project_id is
  'Optional current system context. Cleared when that system is deleted; the user-owned chat is retained.';

comment on column public.user_conversations.site_id is
  'Optional current Site context. Cleared when that Site is deleted; the user-owned chat is retained.';
