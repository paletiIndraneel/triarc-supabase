-- Multi-station, phase 3, step 4. All additive.
--
-- A. A station's platform locations live on the station itself (billing_invoice_stations),
--    replacing the station_locations table (copied here; drop it separately).
--    Each entry: {"provider": "chargemod", "location_id": "1783154310261", "location_name": "..."}.
alter table public.billing_invoice_stations
  add column if not exists platform_locations jsonb not null default '[]'::jsonb;

update public.billing_invoice_stations s
set platform_locations = l.locations
from (select station_id,
             jsonb_agg(jsonb_build_object('provider', provider, 'location_id', location_id, 'location_name', location_name)
                       order by created_at) as locations
      from public.station_locations group by station_id) l
where l.station_id = s.id and s.platform_locations = '[]'::jsonb;

-- A platform location belongs to one station only.
create or replace function public.station_platform_locations_unique()
returns trigger
language plpgsql
set search_path = ''
as $$
declare clash text;
begin
  select e->>'provider' || ' ' || (e->>'location_id') into clash
  from jsonb_array_elements(new.platform_locations) e
  where exists (select 1 from public.billing_invoice_stations other, jsonb_array_elements(other.platform_locations) o
                where other.id <> new.id and o->>'provider' = e->>'provider' and o->>'location_id' = e->>'location_id')
  limit 1;
  if clash is not null then
    raise exception 'Platform location % is already linked to another station.', clash using errcode = '23505';
  end if;
  return new;
end;
$$;
create trigger station_platform_locations_unique
before insert or update of platform_locations on public.billing_invoice_stations
for each row execute function public.station_platform_locations_unique();

-- Same columns as before; the link now comes from the station's platform_locations.
create or replace view public.session_locations with (security_invoker = true) as
select t.provider,
       t.location_id::text as location_id,
       max(t.location) as location_name,
       count(*) as sessions,
       max(t.started_at) as last_session_at,
       st.id as station_id
from public.cms_transactions t
left join lateral (
  select s.id from public.billing_invoice_stations s, jsonb_array_elements(s.platform_locations) e
  where e->>'provider' = t.provider and e->>'location_id' = t.location_id::text
  limit 1
) st on true
where t.location_id is not null
group by t.provider, t.location_id, st.id;

-- B. Which admin modules an admin may open (Access page check boxes). Full-access roles open
--    every module whatever this says. Default = what investors open today.
alter table public.admin_users
  add column if not exists modules text[] not null default '{overview,cms,enquiries}';

create or replace function public.admin_has_module(p_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.admin_full_access())
      or exists (select 1 from public.admin_users au
                 where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                   and p_module = any (au.modules));
$$;
revoke all on function public.admin_has_module(text) from public, anon;
grant execute on function public.admin_has_module(text) to authenticated;

-- Station limits now read the station's own platform_locations.
create or replace function public.admin_can_see_location(p_provider text, p_location_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.admin_full_access())
      or exists (select 1 from public.admin_users au
                 where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                   and (cardinality(au.station_ids) = 0
                        or exists (select 1 from public.billing_invoice_stations s, jsonb_array_elements(s.platform_locations) e
                                   where s.id = any (au.station_ids)
                                     and e->>'provider' = p_provider and e->>'location_id' = p_location_id)));
$$;

-- C. A ticked module works in the database too: one policy per area, next to the existing ones.
create policy "Billing-module admins can manage billing_customers" on public.billing_customers for all to authenticated
using ((select public.admin_has_module('billing'))) with check ((select public.admin_has_module('billing')));
create policy "Billing-module admins can manage billing_inventory" on public.billing_inventory for all to authenticated
using ((select public.admin_has_module('billing'))) with check ((select public.admin_has_module('billing')));
create policy "Billing-module admins can manage billing_invoice_settings" on public.billing_invoice_settings for all to authenticated
using ((select public.admin_has_module('billing'))) with check ((select public.admin_has_module('billing')));
create policy "Billing-module admins can manage billing_invoices" on public.billing_invoices for all to authenticated
using ((select public.admin_has_module('billing'))) with check ((select public.admin_has_module('billing')));
create policy "Billing-module admins can manage billing_items" on public.billing_items for all to authenticated
using ((select public.admin_has_module('billing'))) with check ((select public.admin_has_module('billing')));
-- Stations are edited on the Stations page and added from New Bill.
create policy "Stations- or billing-module admins can manage billing_invoice_stations" on public.billing_invoice_stations for all to authenticated
using ((select public.admin_has_module('stations')) or (select public.admin_has_module('billing')))
with check ((select public.admin_has_module('stations')) or (select public.admin_has_module('billing')));
create policy "CPO-settings-module admins can manage CPO mobile numbers" on public.cpo_mobile_numbers for all to authenticated
using ((select public.admin_has_module('cpo-settings'))) with check ((select public.admin_has_module('cpo-settings')));
