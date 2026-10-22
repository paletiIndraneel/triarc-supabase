-- Multi-station cleanup, run by hand in the SQL editor on 2026-10-22 (recorded here so the repo
-- matches the database). Superseded by admin_users.station_ids / modules (20261022000700/800)
-- and the provider/location_id/location_name columns on billing_invoice_stations (20261022000900).
drop table if exists public.station_locations;
drop table if exists public.admin_station_access;
drop trigger if exists station_platform_locations_unique on public.billing_invoice_stations;
drop function if exists public.station_platform_locations_unique();
alter table public.billing_invoice_stations drop column if exists platform_locations;
