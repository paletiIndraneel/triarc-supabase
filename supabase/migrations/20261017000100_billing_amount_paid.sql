-- Receivables: how much of each invoice has been received. Additive; existing rows keep
-- working. Paid invoices are backfilled to their grand total, everything else to 0.
alter table public.billing_invoices
  add column if not exists amount_paid numeric(14, 2) not null default 0;

alter table public.billing_invoices drop constraint if exists billing_invoices_amount_paid_check;
alter table public.billing_invoices add constraint billing_invoices_amount_paid_check
  check (amount_paid >= 0);

update public.billing_invoices
set amount_paid = coalesce(grand_total, 0)
where invoice_status = 'paid' and amount_paid = 0;
