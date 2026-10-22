-- Multi-station, phase 3, step 2. All additive: no policy, row or column is removed.
--
-- 1. Full access = partner or IT admin, in one function.
create or replace function public.admin_full_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users au
                 where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                   and au.access in ('partner', 'it_admin'));
$$;

-- 2. IT admins get everything partners have: a "Full-access admins" policy beside each
-- partner-only one (permissive policies combine with OR; the partner policies stay as they are).
create policy "Full-access admins can manage billing_customers" on public.billing_customers for all to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));
create policy "Full-access admins can manage billing_inventory" on public.billing_inventory for all to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));
create policy "Full-access admins can manage billing_invoice_settings" on public.billing_invoice_settings for all to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));
create policy "Full-access admins can manage billing_invoice_stations" on public.billing_invoice_stations for all to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));
create policy "Full-access admins can manage billing_invoices" on public.billing_invoices for all to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));
create policy "Full-access admins can manage billing_items" on public.billing_items for all to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));
create policy "Full-access admins can delete cms_transactions" on public.cms_transactions for delete to authenticated
using ((select public.admin_full_access()));
create policy "Full-access admins can read CPO mobile numbers" on public.cpo_mobile_numbers for select to authenticated
using ((select public.admin_full_access()));
create policy "Full-access admins can add CPO mobile numbers" on public.cpo_mobile_numbers for insert to authenticated
with check ((select public.admin_full_access()));
create policy "Full-access admins can update CPO mobile numbers" on public.cpo_mobile_numbers for update to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));
create policy "Full-access admins can delete CPO mobile numbers" on public.cpo_mobile_numbers for delete to authenticated
using ((select public.admin_full_access()));
create policy "Full-access admins can delete enquiries" on public.enquiries for delete to authenticated
using ((select public.admin_full_access()));

-- 3. The stations an investor may see. No rows = all stations (today's behaviour). Written only
-- by the server (Access page, secret key); an admin reads their own rows, full-access admins all.
create table if not exists public.admin_station_access (
  user_id uuid not null references public.admin_users (user_id) on delete cascade,
  station_id uuid not null references public.billing_invoice_stations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, station_id)
);
create index if not exists admin_station_access_station_id_idx on public.admin_station_access (station_id);
alter table public.admin_station_access enable row level security;
revoke all on public.admin_station_access from anon;
create policy "Admins can read their station access" on public.admin_station_access for select to authenticated
using (user_id = (select auth.uid()) or (select public.admin_full_access()));

-- 4. Whether the signed-in admin may see a session of this platform location.
create or replace function public.admin_can_see_location(p_provider text, p_location_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.admin_full_access())
      or not exists (select 1 from public.admin_station_access a where a.user_id = (select auth.uid()))
      or exists (select 1 from public.admin_station_access a
                 join public.station_locations sl on sl.station_id = a.station_id
                 where a.user_id = (select auth.uid()) and sl.provider = p_provider and sl.location_id = p_location_id);
$$;
revoke all on function public.admin_can_see_location(text, text) from public, anon;
grant execute on function public.admin_can_see_location(text, text) to authenticated;

-- 5. A RESTRICTIVE policy is ANDed with the existing read policy: a station-limited investor
-- reads only sessions of their stations' linked locations, even querying the database directly.
create policy "Station-limited admins read only their stations" on public.cms_transactions
as restrictive for select to authenticated
using ((select public.admin_can_see_location(provider, location_id::text)));
