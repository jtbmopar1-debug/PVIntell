-- Persist the grouped Wattson conversation across navigation. This is separate
-- so environments that already applied the initial draft migration can upgrade.

alter table public.discovery_drafts
  add column if not exists conversation_id uuid references public.user_conversations(id) on delete set null;
