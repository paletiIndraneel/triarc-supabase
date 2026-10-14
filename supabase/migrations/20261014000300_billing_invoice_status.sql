-- Invoice lifecycle: invoices are cancelled, never deleted, so their numbers are never
-- reused (next_billing_invoice_number takes the max over all rows in the series).
alter table public.billing_invoices drop constraint if exists billing_invoices_invoice_status_check;
alter table public.billing_invoices add constraint billing_invoices_invoice_status_check
  check (invoice_status in ('draft', 'issued', 'sent', 'partially_paid', 'paid', 'cancelled'));

update public.billing_invoices set invoice_status = 'paid'
where payment_received and invoice_status in ('issued', 'draft');

-- Keep the legacy payment_received flag and invoice_status in step. A change to only
-- payment_received (older clients) moves the status; otherwise the status wins.
create or replace function public.sync_billing_invoice_payment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and new.payment_received is distinct from old.payment_received
     and new.invoice_status is not distinct from old.invoice_status then
    if new.payment_received and new.invoice_status <> 'cancelled' then
      new.invoice_status := 'paid';
    elsif not new.payment_received and new.invoice_status = 'paid' then
      new.invoice_status := 'issued';
    end if;
  end if;
  new.payment_received := new.invoice_status = 'paid';
  return new;
end;
$$;

drop trigger if exists sync_billing_invoice_payment on public.billing_invoices;
create trigger sync_billing_invoice_payment before insert or update on public.billing_invoices
for each row execute function public.sync_billing_invoice_payment();

revoke delete on public.billing_invoices from anon, authenticated;
