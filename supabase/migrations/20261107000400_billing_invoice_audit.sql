-- A record of every change to an invoice: the row before and after, and its items before the
-- change (save_billing_invoice replaces them after updating the invoice). Written only by the
-- trigger; read by full-access admins. Invoices are never deleted, so there is no delete case.
create table if not exists public.billing_invoice_audit (
  id bigint generated always as identity primary key,
  invoice_id uuid not null,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  old_row jsonb not null,
  new_row jsonb not null,
  old_items jsonb not null
);
create index if not exists billing_invoice_audit_invoice_idx on public.billing_invoice_audit (invoice_id, changed_at);

alter table public.billing_invoice_audit enable row level security;
revoke all on public.billing_invoice_audit from anon, authenticated;
grant select on public.billing_invoice_audit to authenticated;
create policy "Full-access admins can read billing_invoice_audit" on public.billing_invoice_audit for select to authenticated
using ((select public.admin_full_access()));

create or replace function public.log_billing_invoice_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
    insert into public.billing_invoice_audit (invoice_id, changed_by, old_row, new_row, old_items)
    values (old.id, (select auth.uid()), to_jsonb(old), to_jsonb(new),
      coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at) from public.billing_items b where b.invoice_id = old.id), '[]'::jsonb));
  end if;
  return null;
end;
$$;
revoke all on function public.log_billing_invoice_change() from public, anon, authenticated;

drop trigger if exists log_billing_invoice_change on public.billing_invoices;
create trigger log_billing_invoice_change after update on public.billing_invoices
for each row execute function public.log_billing_invoice_change();
