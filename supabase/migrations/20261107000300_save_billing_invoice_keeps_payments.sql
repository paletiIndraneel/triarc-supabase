-- Editing an invoice keeps its payment state true. amount_paid and invoice_status are the
-- server's on an edit: a total raised above what was received moves a paid invoice to partially
-- paid (or issued, if nothing was received), a total lowered to what was received makes it paid,
-- and a total below what was received is refused until the payment is corrected. Everything else
-- is as in 20261107000100.
create or replace function public.save_billing_invoice(p_invoice_id uuid, p_invoice jsonb, p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cols text;
  v_id uuid;
  v_type text;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_qty numeric; v_price numeric; v_disc_pct numeric; v_gst numeric;
  v_gross numeric; v_disc numeric; v_incl numeric; v_taxable numeric; v_tax numeric;
  v_sum_taxable numeric := 0;
  v_sum_tax numeric := 0;
  v_total numeric;
  v_paid numeric;
  v_status text;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item.' using errcode = '22023';
  end if;

  v_type := coalesce(p_items -> 0 ->> 'tax_type', 'CGST_SGST');
  if v_type not in ('IGST', 'CGST_SGST') then
    raise exception 'Unknown tax type.' using errcode = '22023';
  end if;

  for v_item in select e from jsonb_array_elements(p_items) e loop
    v_qty := coalesce((v_item ->> 'quantity')::numeric, 0);
    v_price := coalesce((v_item ->> 'unit_price')::numeric, 0);
    v_disc_pct := coalesce((v_item ->> 'discount_percent')::numeric, 0);
    v_gst := coalesce((v_item ->> 'gst_rate')::numeric, 0);
    if v_qty < 0 or v_price < 0 or v_disc_pct not between 0 and 100 or v_gst not between 0 and 100 then
      raise exception 'Item quantity, rate, discount or GST is out of range.' using errcode = '22023';
    end if;

    v_gross := v_qty * v_price;
    v_disc := v_gross * v_disc_pct / 100;
    v_incl := v_gross - v_disc;
    v_taxable := v_incl / (1 + v_gst / 100);
    v_tax := v_incl - v_taxable;
    v_sum_taxable := v_sum_taxable + v_taxable;
    v_sum_tax := v_sum_tax + v_tax;

    v_items := v_items || jsonb_build_array(v_item || jsonb_build_object(
      'discount_amount', v_disc,
      'taxable_amount', v_taxable,
      'tax_type', v_type,
      'cgst_rate', case when v_type = 'CGST_SGST' then v_gst / 2 else 0 end,
      'cgst_amount', case when v_type = 'CGST_SGST' then v_tax / 2 else 0 end,
      'sgst_rate', case when v_type = 'CGST_SGST' then v_gst / 2 else 0 end,
      'sgst_amount', case when v_type = 'CGST_SGST' then v_tax / 2 else 0 end,
      'igst_rate', case when v_type = 'IGST' then v_gst else 0 end,
      'igst_amount', case when v_type = 'IGST' then v_tax else 0 end,
      'cess_rate', 0,
      'cess_amount', 0,
      'line_total', v_incl));
  end loop;
  p_items := v_items;

  v_total := v_sum_taxable + v_sum_tax;
  p_invoice := p_invoice || jsonb_build_object(
    'subtotal', v_sum_taxable,
    'discount_total', 0,
    'taxable_amount', v_sum_taxable,
    'cgst_amount', case when v_type = 'CGST_SGST' then v_sum_tax / 2 else 0 end,
    'sgst_amount', case when v_type = 'CGST_SGST' then v_sum_tax / 2 else 0 end,
    'igst_amount', case when v_type = 'IGST' then v_sum_tax else 0 end,
    'cess_amount', 0,
    'total_tax', v_sum_tax,
    'round_off', round(v_total) - v_total,
    'grand_total', round(v_total));

  if p_invoice_id is not null then
    select i.amount_paid, i.invoice_status into v_paid, v_status
    from public.billing_invoices i where i.id = p_invoice_id for update;
    if v_paid > round(v_total) then
      raise exception 'Rs % has been received on this invoice, more than the new total of Rs %. Correct the payment first.', v_paid, round(v_total) using errcode = '22023';
    end if;
    if v_status in ('paid', 'partially_paid') then
      v_status := case when v_paid >= round(v_total) then 'paid' when v_paid > 0 then 'partially_paid' else 'issued' end;
    end if;
    p_invoice := (p_invoice - 'amount_paid') || jsonb_build_object('invoice_status', v_status);
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
