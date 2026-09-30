-- Shadow-mode Wattson Credit metering. This records proposed charges without
-- deducting a balance or restricting any user action during testing.
create table if not exists public.wattson_credit_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  action_key text not null check (action_key in (
    'system_proposal',
    'proposal_rebuild',
    'captured_component',
    'monitoring_connection',
    'handover_review',
    'image_analysis',
    'wattson_reply'
  )),
  proposed_credits integer not null check (proposed_credits > 0),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists wattson_credit_usage_idempotency_uidx
  on public.wattson_credit_usage(owner_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists wattson_credit_usage_owner_created_idx
  on public.wattson_credit_usage(owner_id, created_at desc);

alter table public.wattson_credit_usage enable row level security;

-- No authenticated policies are intentional. Shadow usage is written and read
-- only by trusted server code through the service-role client.
revoke all on table public.wattson_credit_usage from anon, authenticated;

comment on table public.wattson_credit_usage is
  'Testing-only ledger of proposed Wattson Credit charges. No balance is deducted.';
