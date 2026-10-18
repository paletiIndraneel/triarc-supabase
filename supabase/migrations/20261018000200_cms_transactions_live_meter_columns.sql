-- Store the latest live ChargeMOD meter-values response on the existing transaction row.
alter table public.cms_transactions
  add column if not exists meter_values_response jsonb,
  add column if not exists meter_values_readings jsonb not null default '[]'::jsonb,
  add column if not exists current_soc numeric,
  add column if not exists meter_values_last_reading_at timestamptz,
  add column if not exists meter_values_fetched_at timestamptz;
