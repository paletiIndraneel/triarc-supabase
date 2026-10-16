-- A station carries its own place of supply: the text printed on the invoice and its
-- GST state code. Replaces billing_place_of_supply (dropped in 20261016000400).
alter table public.billing_invoice_stations
  add column if not exists place_of_supply text,
  add column if not exists state_code text constraint billing_invoice_stations_state_code_check check (state_code ~ '^\d{2}$');

-- The only station today is at Bhadrachalam, Telangana.
update public.billing_invoice_stations
set place_of_supply = 'Bhadrachalam-Telangana', state_code = '36'
where name = 'Triarc EV hub | Bhadrachalam' and place_of_supply is null;
