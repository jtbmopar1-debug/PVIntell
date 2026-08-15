alter table public.system_connections
add column polarity text not null default 'na'
check (polarity in ('positive', 'negative', 'pair', 'na'));
