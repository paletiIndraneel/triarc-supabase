-- The history backfill and live session views save sessions and meter values for any active
-- admin, partner or investor. Insert and update open to all active admins; delete stays
-- partner-only, and reads are unchanged.
drop policy if exists "Partners can write cms_transactions" on public.cms_transactions;

drop policy if exists "Active admins can add cms_transactions" on public.cms_transactions;
create policy "Active admins can add cms_transactions" on public.cms_transactions for insert to authenticated
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

drop policy if exists "Active admins can update cms_transactions" on public.cms_transactions;
create policy "Active admins can update cms_transactions" on public.cms_transactions for update to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true))
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

drop policy if exists "Partners can delete cms_transactions" on public.cms_transactions;
create policy "Partners can delete cms_transactions" on public.cms_transactions for delete to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                 and au.access = 'partner'));
