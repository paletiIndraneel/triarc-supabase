-- Keep the latest ChargeMOD meter-values response for each live transaction.
create table if not exists public.cms_live_meter_values (
  transaction_id text primary key,
  response jsonb not null,
  parsed_readings jsonb not null default '[]'::jsonb,
  current_soc numeric,
  last_reading_at timestamptz,
  fetched_at timestamptz not null default now()
);

create index if not exists cms_live_meter_values_fetched_at_idx
  on public.cms_live_meter_values (fetched_at desc);

alter table public.cms_live_meter_values enable row level security;
revoke all on public.cms_live_meter_values from anon;

create policy "Active admins can read cms_live_meter_values"
  on public.cms_live_meter_values for select to authenticated
  using (exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role = 'admin'
      and au.active = true
  ));

create policy "Active admins can write cms_live_meter_values"
  on public.cms_live_meter_values for all to authenticated
  using (exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role = 'admin'
      and au.active = true
  ))
  with check (exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role = 'admin'
      and au.active = true
  ));
