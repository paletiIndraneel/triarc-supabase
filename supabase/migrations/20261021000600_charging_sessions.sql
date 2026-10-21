-- charging_sessions: the multi-platform copy of cms_transactions. cms_transactions is left
-- untouched (live data). Same columns, defaults, primary key and indexes, plus `provider`;
-- session ids carry the platform's prefix from src/lib/cms/providerIds.ts ("chrgmod_" for
-- ChargeMOD) so two platforms can never clash. The app picks the table with SESSIONS_TABLE in
-- src/lib/cms/transactionStore.ts; README.txt says how to switch it. Applied 2026-10-21.
create table if not exists public.charging_sessions (like public.cms_transactions including all);
alter table public.charging_sessions add column if not exists provider text not null default 'chargemod';
create index if not exists charging_sessions_provider_started_at_idx on public.charging_sessions (provider, started_at);

alter table public.charging_sessions enable row level security;
revoke all on public.charging_sessions from anon;

-- Same access as cms_transactions: active admins read, add and update; partners delete.
create policy "Active admins can read charging_sessions" on public.charging_sessions for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

create policy "Active admins can add charging_sessions" on public.charging_sessions for insert to authenticated
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

create policy "Active admins can update charging_sessions" on public.charging_sessions for update to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true))
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

create policy "Partners can delete charging_sessions" on public.charging_sessions for delete to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                 and au.access = 'partner'));

-- Copy the existing ChargeMOD sessions with their ids prefixed (1,600 rows on 2026-10-21).
-- Safe to run again: rows already copied are skipped.
insert into public.charging_sessions (provider, transaction_id, id, charger_id, connector_id, started_at, stopped_at, user_name, mobile, user_type, tag_reference, location, location_id, charger_name, station_type, type, stop_reason, energy_kwh, start_soc, end_soc, vehicle_name, vehicle_number, tariff_amount, vat, invoice_available, user_id, vehicle_id, geo_latitude, geo_longitude, id_tag, is_free, base_deductive_amount, is_alpha_guaranteed, is_time_based_tariff, start_value, stop_value, created_at, updated_at, invoice_link, organization_id, project_id, solar_type, user_email, vehicle_model_id, starting_balance, ending_balance, synced_at, meter_values_response, meter_values_readings, current_soc, meter_values_last_reading_at, meter_values_fetched_at)
select 'chargemod', 'chrgmod_' || transaction_id, case when coalesce(id, '') <> '' then 'chrgmod_' || id else id end, charger_id, connector_id, started_at, stopped_at, user_name, mobile, user_type, tag_reference, location, location_id, charger_name, station_type, type, stop_reason, energy_kwh, start_soc, end_soc, vehicle_name, vehicle_number, tariff_amount, vat, invoice_available, user_id, vehicle_id, geo_latitude, geo_longitude, id_tag, is_free, base_deductive_amount, is_alpha_guaranteed, is_time_based_tariff, start_value, stop_value, created_at, updated_at, invoice_link, organization_id, project_id, solar_type, user_email, vehicle_model_id, starting_balance, ending_balance, synced_at, meter_values_response, meter_values_readings, current_soc, meter_values_last_reading_at, meter_values_fetched_at
from public.cms_transactions
on conflict (transaction_id) do nothing;
