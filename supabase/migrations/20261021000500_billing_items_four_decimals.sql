-- Rates (e.g. 25.9764 per kWh) and quantities (kWh) are kept to 4 decimals, like the billing
-- items' selling_price. Widening the scale keeps every stored value as it is.
alter table public.billing_items
  alter column quantity type numeric(16, 4),
  alter column unit_price type numeric(16, 4),
  alter column source_kwh type numeric(16, 4);
