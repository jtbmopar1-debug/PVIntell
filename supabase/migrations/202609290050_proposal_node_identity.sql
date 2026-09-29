-- Generated proposal records need a stable internal save key. Display names
-- remain editable specifications and are not entity identity.
create unique index if not exists pv_arrays_proposal_node_identity_idx
  on public.pv_arrays (project_id, (specifications->>'Proposal node id'))
  where specifications->>'Proposal source' = 'Wattson design'
    and nullif(specifications->>'Proposal node id', '') is not null;

create unique index if not exists system_components_proposal_node_identity_idx
  on public.system_components (project_id, (specifications->>'Proposal node id'))
  where specifications->>'Proposal source' = 'Wattson design'
    and nullif(specifications->>'Proposal node id', '') is not null;
