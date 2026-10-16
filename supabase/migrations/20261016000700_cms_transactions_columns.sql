-- cms_transactions gets one column per field of the sanitized transaction
-- (operator.ts sanitizeTransaction), each camelCase key in snake_case. The table only held
-- test rows from 20261016000600, so it is rebuilt; the next dashboard load refills it from
-- ChargeMOD (an empty table triggers a full sync of the window). ChargeMOD's own
-- createdAt/updatedAt keep those names; synced_at is ours.
drop table if exists public.cms_transactions;

create table public.cms_transactions (
  transaction_id text primary key,
  id text,
  charger_id text,
  connector_id integer,
  started_at timestamptz,
  stopped_at timestamptz,
  user_name text,
  mobile text,
  user_type text,
  tag_reference text,
  location text,
  location_id bigint,
  charger_name text,
  station_type text,
  type text,
  stop_reason text,
  energy_kwh numeric,
  start_soc numeric,
  end_soc numeric,
  vehicle_name text,
  vehicle_number text,
  tariff_amount numeric,
  vat numeric,
  invoice_available boolean,
  user_id text,
  vehicle_id text,
  geo_latitude double precision,
  geo_longitude double precision,
  id_tag text,
  is_free boolean,
  base_deductive_amount numeric,
  is_alpha_guaranteed boolean,
  is_time_based_tariff boolean,
  start_value numeric,
  stop_value numeric,
  created_at timestamptz,
  updated_at timestamptz,
  invoice_link text,
  organization_id text,
  project_id text,
  solar_type text,
  user_email text,
  vehicle_model_id text,
  starting_balance numeric,
  ending_balance numeric,
  synced_at timestamptz not null default now()
);
create index cms_transactions_started_at_idx on public.cms_transactions (started_at);

alter table public.cms_transactions enable row level security;
revoke all on public.cms_transactions from anon;

create policy "Active admins can read cms_transactions" on public.cms_transactions for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

create policy "Partners can write cms_transactions" on public.cms_transactions for all to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                 and au.access = 'partner'))
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                      and au.access = 'partner'));
