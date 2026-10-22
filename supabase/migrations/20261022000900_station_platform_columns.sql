-- Multi-station, phase 3, step 5: a station's platform location is plain columns on
-- billing_invoice_stations, one record per station per charging platform (CMS). Records with the
-- same name are one station in the admin (Bhadrachalam: a ChargeMOD record now, an Ather record
-- later). Replaces platform_locations (20261022000800) and station_locations (copied; drop both
-- separately). All additive.
alter table public.billing_invoice_stations
  add column if not exists provider text,
  add column if not exists location_id text,
  add column if not exists location_name text;

-- Each station has at most one location today, so the first entry is all there is.
update public.billing_invoice_stations
set provider = platform_locations->0->>'provider',
    location_id = platform_locations->0->>'location_id',
    location_name = platform_locations->0->>'location_name'
where provider is null and jsonb_array_length(platform_locations) > 0;

-- A platform location belongs to one record only.
create unique index if not exists billing_invoice_stations_platform_location_key
  on public.billing_invoice_stations (provider, location_id)
  where provider is not null and location_id is not null;

create or replace view public.session_locations with (security_invoker = true) as
select t.provider,
       t.location_id::text as location_id,
       max(t.location) as location_name,
       count(*) as sessions,
       max(t.started_at) as last_session_at,
       s.id as station_id
from public.cms_transactions t
left join public.billing_invoice_stations s on s.provider = t.provider and s.location_id = t.location_id::text
where t.location_id is not null
group by t.provider, t.location_id, s.id;

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
                        -- a ticked record stands for its whole station: every record with its name
                        or exists (select 1 from public.billing_invoice_stations s
                                   where s.name in (select t.name from public.billing_invoice_stations t where t.id = any (au.station_ids))
                                     and s.provider = p_provider and s.location_id = p_location_id)));
$$;
