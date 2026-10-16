-- Place of supply now lives on billing_invoice_stations (20261016000300). Invoices keep
-- their own saved place_of_supply text and code, so nothing references this table.
-- Applied 2026-10-16 (the live site has no admin area, so nothing else reads it).
drop table if exists public.billing_place_of_supply;
