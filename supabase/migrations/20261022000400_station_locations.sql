-- Multi-station, phase 1: stations are the rows of billing_invoice_stations; each charging
-- platform location (ChargeMOD, Ather, ...) is linked to one station here, from the admin's
-- Stations page, so New Bill can count one station's sessions and a new station or platform
-- location never needs a code change. All additive.

-- One place that says who has full admin access (today: active partners). Phase 3 adds the
-- IT admin level here, and every policy that uses it follows.
create or replace function public.admin_full_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users au
                 where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                   and au.access = 'partner');
$$;
revoke all on function public.admin_full_access() from public, anon;
grant execute on function public.admin_full_access() to authenticated;

-- Platform location -> station. location_id is text so any platform's id fits (ChargeMOD's
-- are numbers, compared as text against cms_transactions.location_id).
create table if not exists public.station_locations (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.billing_invoice_stations (id) on delete cascade,
  provider text not null,
  location_id text not null,
  location_name text,
  created_at timestamptz not null default now(),
  constraint station_locations_one_station unique (provider, location_id)
);
create index if not exists station_locations_station_id_idx on public.station_locations (station_id);

alter table public.station_locations enable row level security;
revoke all on public.station_locations from anon;

create policy "Active admins can read station_locations" on public.station_locations for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

create policy "Full-access admins can add station_locations" on public.station_locations for insert to authenticated
with check ((select public.admin_full_access()));

create policy "Full-access admins can update station_locations" on public.station_locations for update to authenticated
using ((select public.admin_full_access()))
with check ((select public.admin_full_access()));

create policy "Full-access admins can delete station_locations" on public.station_locations for delete to authenticated
using ((select public.admin_full_access()));

-- Station names for every active admin (the dashboard's station selector); writes stay
-- partner-only through the existing "Partners can manage billing_invoice_stations".
create policy "Active admins can read billing_invoice_stations" on public.billing_invoice_stations for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

-- Which station an invoice is for (per-station reports later). Old invoices keep null.
alter table public.billing_invoices
  add column if not exists station_id uuid references public.billing_invoice_stations (id) on delete set null;

-- Every platform location seen in the sessions, with whether it is linked yet: what the
-- Stations page lists. security_invoker, so the caller's RLS on cms_transactions applies.
create or replace view public.session_locations with (security_invoker = true) as
select t.provider,
       t.location_id::text as location_id,
       max(t.location) as location_name,
       count(*) as sessions,
       max(t.started_at) as last_session_at,
       sl.station_id
from public.cms_transactions t
left join public.station_locations sl on sl.provider = t.provider and sl.location_id = t.location_id::text
where t.location_id is not null
group by t.provider, t.location_id, sl.station_id;
revoke all on public.session_locations from anon;
grant select on public.session_locations to authenticated;

-- Today's only station and location: Bhadrachalam <- ChargeMOD 1783154310261.
insert into public.station_locations (station_id, provider, location_id, location_name)
select s.id, 'chargemod', '1783154310261', 'Triarc EV hub | Bhadrachalam'
from public.billing_invoice_stations s
where s.active
order by s.created_at
limit 1
on conflict (provider, location_id) do nothing;
