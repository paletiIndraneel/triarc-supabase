-- Invoices take their place of supply from the station (20261016000300); nothing reads or
-- writes the customer's copy any more.
alter table public.billing_customers drop column if exists place_of_supply;
