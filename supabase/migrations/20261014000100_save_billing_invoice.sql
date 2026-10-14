-- Save a billing invoice and its items in one transaction.
-- Previously the browser updated the invoice, deleted its items and inserted the
-- new ones as separate requests, so a failed insert left an invoice with no items.
--
-- p_invoice_id: null to create, otherwise the invoice to update.
-- p_invoice:    billing_invoices columns to write (keys that aren't columns are ignored).
-- p_items:      array of billing_items columns; invoice_id is set here. Items replace
--               any existing ones and keep their array order (via created_at).
--
-- SECURITY INVOKER: the caller's RLS policies on both tables still apply.
create or replace function public.save_billing_invoice(p_invoice_id uuid, p_invoice jsonb, p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cols text;
  v_id uuid;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item.' using errcode = '22023';
  end if;

  select string_agg(quote_ident(a.attname), ',' order by a.attnum) into v_cols
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.billing_invoices'::regclass and a.attnum > 0 and not a.attisdropped
    and a.attname not in ('id', 'created_at', 'updated_at') and p_invoice ? a.attname;

  if p_invoice_id is null then
    execute format(
      'insert into public.billing_invoices (%1$s) select %1$s from jsonb_populate_record(null::public.billing_invoices, $1) returning id',
      v_cols) into v_id using p_invoice;
  else
    execute format(
      'update public.billing_invoices set (%1$s) = (select %1$s from jsonb_populate_record(null::public.billing_invoices, $1)), updated_at = now() where id = $2 returning id',
      v_cols) into v_id using p_invoice, p_invoice_id;
    if v_id is null then
      raise exception 'Invoice not found.' using errcode = 'P0002';
    end if;
    delete from public.billing_items where invoice_id = v_id;
  end if;

  select string_agg(quote_ident(a.attname), ',' order by a.attnum) into v_cols
  from pg_catalog.pg_attribute a
  where a.attrelid = 'public.billing_items'::regclass and a.attnum > 0 and not a.attisdropped
    and a.attname not in ('id', 'invoice_id', 'created_at') and (p_items -> 0) ? a.attname;

  execute format(
    'insert into public.billing_items (invoice_id, created_at, %1$s)
     select $2, now() + e.n * interval ''1 microsecond'', %1$s
     from jsonb_array_elements($1) with ordinality e(item, n),
          jsonb_populate_record(null::public.billing_items, e.item) r',
    v_cols) using p_items, v_id;

  return jsonb_build_object(
    'invoice', (select to_jsonb(i) from public.billing_invoices i where i.id = v_id),
    'items', (select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at), '[]'::jsonb)
              from public.billing_items b where b.invoice_id = v_id));
end;
$$;

revoke execute on function public.save_billing_invoice(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_billing_invoice(uuid, jsonb, jsonb) to authenticated;
