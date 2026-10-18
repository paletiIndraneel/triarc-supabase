-- Charging-session suggestions in New Bill, and the links later reports need.
-- All columns are nullable and additive: existing customers, items and invoices are unchanged.

-- Which platform's charging sessions a customer is billed for (ChargeMOD now, Ather later).
alter table public.billing_customers
  add column if not exists session_source text
    constraint billing_customers_session_source_check check (session_source in ('chargemod', 'ather'));

-- A billing item can belong to one customer (its own rate card) or be general (null), and
-- says which charger type it bills so suggestions can pick the AC and DC lines.
alter table public.billing_inventory
  add column if not exists customer_id uuid references public.billing_customers (id) on delete set null,
  add column if not exists charger_type text
    constraint billing_inventory_charger_type_check check (charger_type in ('AC', 'DC'));
create index if not exists billing_inventory_customer_id_idx on public.billing_inventory (customer_id);

-- What the charging data showed when a suggested line was added, so a reconciliation report
-- can compare it with the quantity actually invoiced. Null on lines typed by hand.
alter table public.billing_items
  add column if not exists source_kwh numeric(14, 3) constraint billing_items_source_kwh_check check (source_kwh >= 0),
  add column if not exists source_sessions integer constraint billing_items_source_sessions_check check (source_sessions >= 0);

-- Current data: the two kWh items are general AC and DC items.
update public.billing_inventory set charger_type = 'AC' where charger_type is null and product_name ilike 'AC%';
update public.billing_inventory set charger_type = 'DC' where charger_type is null and product_name ilike 'DC%';
