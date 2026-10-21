-- cms_transactions becomes the multi-platform sessions table (applied live 2026-10-21, in this
-- order). The app reads and writes it through SESSIONS_TABLE in src/lib/cms/transactionStore.ts.

-- 1. Safety copy of every row as it was, before any change. Locked: RLS on, no policies, no grants.
create table if not exists public.cms_transactions_backup_20261021 as select * from public.cms_transactions;
alter table public.cms_transactions_backup_20261021 enable row level security;
revoke all on public.cms_transactions_backup_20261021 from anon, authenticated;

-- 2. Which charging platform a session comes from (src/lib/cms/providerIds.ts).
alter table public.cms_transactions add column if not exists provider text not null default 'chargemod';
create index if not exists cms_transactions_provider_started_at_idx on public.cms_transactions (provider, started_at);

-- 3. Platform prefix on the session ids, so two platforms can never clash. No rows are removed;
-- only the two id columns change (1,602 rows). Run with nothing writing the table.
update public.cms_transactions
set transaction_id = 'chrgmod_' || transaction_id,
    id = case when coalesce(id, '') <> '' then 'chrgmod_' || id else id end
where transaction_id not like 'chrgmod\_%';
