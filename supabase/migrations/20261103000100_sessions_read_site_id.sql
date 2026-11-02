-- Platform-neutral sessions, step 2 of 3: read the site from site_id.
-- Every reader uses coalesce(site_id, location_id::text), so a row written before site_id existed
-- still resolves to its numeric location. For ChargeMOD the two are equal today, so nothing a
-- user sees changes. Functions that only touch the billing station table are not changed.

-- 1. The station/location view the pickers and the access rules group by.
create or replace view public.session_locations with (security_invoker = true) as
select t.provider,
       coalesce(t.site_id, t.location_id::text) as location_id,
       max(t.location) as location_name,
       count(*) as sessions,
       max(t.started_at) as last_session_at,
       s.id as station_id
from public.cms_transactions t
left join public.billing_invoice_stations s
  on s.provider = t.provider and s.location_id = coalesce(t.site_id, t.location_id::text)
where coalesce(t.site_id, t.location_id::text) is not null
group by t.provider, coalesce(t.site_id, t.location_id::text), s.id;

-- 2. The station-limit rule on sessions: an investor limited to some stations reads only those.
alter policy "Station-limited admins read only their stations" on public.cms_transactions
  using ((select public.admin_can_see_location(cms_transactions.provider, coalesce(cms_transactions.site_id, cms_transactions.location_id::text))));

-- 3. Which CPO numbers an admin may match: only mobiles on sessions the caller can see.
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
                      and public.admin_can_see_location(t.provider, coalesce(t.site_id, t.location_id::text))));
$$;
