-- Investors are read-only (owner decision, 1 Nov 2026). An admin without full access sees the
-- CMS sessions of their own stations (with the CPO / customer split) and the enquiries, and may
-- add CPO numbers. Everything else is full access only. The server still saves every
-- platform's sessions with the secret key, so partners see all stations.
-- Security audit run-1 leads: cms_transactions writes, station-limit widening through
-- billing_invoice_stations, charging_sessions copy, billing station limit, enquiry rewrites,
-- cpo_mobile_matches membership oracle.

-- 1. Modules an admin without full access can hold: cms, enquiries, cpo-settings. Billing,
--    Stations and Platform Bills drop out here, so their module policies (20261022000800,
--    20261029000200) now pass for full access only. Same list as GRANTABLE_MODULES.
create or replace function public.admin_has_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.admin_full_access())
      or (p_module in ('cms', 'enquiries', 'cpo-settings')
          and exists (select 1 from public.admin_users au
                      where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                        and p_module = any (au.modules)));
$$;

-- 2. Sessions: only the server writes them (secret key, which RLS does not apply to). The
--    signed-in fallback for a deployment without the key is kept for full-access admins.
drop policy if exists "Active admins can add cms_transactions" on public.cms_transactions;
drop policy if exists "Active admins can update cms_transactions" on public.cms_transactions;
create policy "Full-access admins can add cms_transactions" on public.cms_transactions for insert to authenticated
with check ((select public.admin_full_access()));
create policy "Full-access admins can update cms_transactions" on public.cms_transactions for update to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));

-- 3. The unused copy of the sessions (README: "No longer used") had no station limit. Closed
--    to signed-in users rather than dropped, so no data is deleted; drop it when convenient.
do $$
begin
  if to_regclass('public.charging_sessions') is not null then
    execute 'revoke all on table public.charging_sessions from anon, authenticated';
  end if;
end $$;

-- 4. Enquiries: read with the Enquiries module, changed only with full access.
drop policy if exists "Active admins can read enquiries" on public.enquiries;
create policy "Enquiries-module admins can read enquiries" on public.enquiries for select to authenticated
using ((select public.admin_has_module('enquiries')));
drop policy if exists "Active admins can update enquiries" on public.enquiries;
create policy "Full-access admins can update enquiries" on public.enquiries for update to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));

-- 5. CPO numbers: a CPO-settings admin may add one (as themselves) but not read, edit or
--    delete the list; full-access admins keep their own policies (20261022000600).
drop policy if exists "CPO-settings-module admins can manage CPO mobile numbers" on public.cpo_mobile_numbers;
create policy "CPO-settings-module admins can add CPO mobile numbers" on public.cpo_mobile_numbers for insert to authenticated
with check ((select public.admin_has_module('cpo-settings')) and created_by = (select auth.uid()));

-- 6. cpo_mobile_matches answers only for mobiles on sessions the caller can see (their
--    stations), so it marks their sessions CPO / customer without revealing the list.
--    Full-access admins (and the provider-bills route) match any mobile.
create or replace function public.cpo_mobile_matches(p_mobiles text[])
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select c.normalized_mobile
  from public.cpo_mobile_numbers c
  where c.normalized_mobile = any (p_mobiles)
    and cardinality(p_mobiles) <= 1000
    and exists (select 1 from public.admin_users au
                where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true)
    and ((select public.admin_full_access())
         or exists (select 1 from public.cms_transactions t
                    where right(regexp_replace(coalesce(t.mobile, ''), '\D', '', 'g'), 10) = c.normalized_mobile
                      and public.admin_can_see_location(t.provider, t.location_id::text)));
$$;
