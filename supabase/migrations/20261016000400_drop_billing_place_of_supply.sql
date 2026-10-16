-- Place of supply now lives on billing_invoice_stations (20261016000300). Invoices keep
-- their own saved place_of_supply text and code, so nothing references this table.
-- Apply only once the live site runs code that no longer reads it.
drop table if exists public.billing_place_of_supply;
