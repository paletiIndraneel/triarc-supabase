-- Reading the sessions table needs the CMS module: its rows carry customer names, mobiles and
-- vehicle numbers. Overview stays open to every admin (owner decision, 7 Nov 2026): /api/cms/operator
-- gives an admin without the module the same sessions without the customer columns. The restrictive
-- station policy stays as it is.
drop policy if exists "Active admins can read cms_transactions" on public.cms_transactions;
create policy "CMS-module admins can read cms_transactions" on public.cms_transactions for select to authenticated
using ((select public.admin_has_module('cms')));
