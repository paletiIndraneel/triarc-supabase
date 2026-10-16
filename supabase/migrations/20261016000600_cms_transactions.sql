-- ChargeMOD sessions saved in our own database, one row per session. /api/cms/operator
-- upserts every session it loads for a partner; data holds the sanitized transaction
-- (operator.ts sanitizeTransaction).
create table if not exists public.cms_transactions (
  transaction_id text primary key,
  started_at timestamptz,
  data jsonb not null,
  synced_at timestamptz not null default now()
);
create index if not exists cms_transactions_started_at_idx on public.cms_transactions (started_at);

alter table public.cms_transactions enable row level security;
revoke all on public.cms_transactions from anon;

create policy "Active admins can read cms_transactions" on public.cms_transactions for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

create policy "Partners can write cms_transactions" on public.cms_transactions for all to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                 and au.access = 'partner'))
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                      and au.access = 'partner'));
