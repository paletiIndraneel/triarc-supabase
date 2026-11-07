-- RLS behaviour tests: who can read and change what, acting as each kind of user.
--
-- Safe to run against the live project: everything (test users, rows, role switches) happens
-- inside one DO block that ALWAYS ends by raising an exception, so Postgres rolls all of it
-- back even if the runner does not wrap it in a transaction. The result is that exception's
-- message: "RLS OK: ..." when every check passed, "RLS FAILED: ..." otherwise.
--
-- Run: `npm test` with SUPABASE_ACCESS_TOKEN set (tests/rls.test.mjs posts this file to the
-- Management API), or paste it into the SQL editor and read the error message.
-- Known gaps (behaviour we want but don't have yet) are listed in the message, not failed.
do $$
declare
  u_p uuid := gen_random_uuid();   -- partner
  u_t uuid := gen_random_uuid();   -- IT admin
  u_i uuid := gen_random_uuid();   -- investor: overview, cms, enquiries, cpo-settings (add only)
  u_ib uuid := gen_random_uuid();  -- investor with billing ticked but no enquiries (billing is full access only)
  u_is uuid := gen_random_uuid();  -- investor limited to station A
  u_nc uuid := gen_random_uuid();  -- investor without the cms module
  u_x uuid := gen_random_uuid();   -- inactive partner
  u_n uuid := gen_random_uuid();   -- signed in, not an admin
  st_a uuid; st_b uuid; cust uuid; inv uuid; enq uuid;
  tx_a text := 'rlstest_a_' || gen_random_uuid();
  tx_b text := 'rlstest_b_' || gen_random_uuid();
  tbl text; who text; n bigint; denied boolean;
  total int := 0; fails text[] := '{}'; gaps text[] := '{}';
  sensitive text[] := array['enquiries', 'billing_invoices', 'billing_customers', 'billing_items',
    'cms_transactions', 'cpo_mobile_numbers', 'admin_users', 'cms_session', 'devices', 'device_commands',
    'provider_settings', 'provider_bills', 'billing_invoice_audit'];
begin
  -- Fixtures, as the database owner.
  insert into auth.users (id, email, aud, role)
  select id, 'rls-' || id || '@test.invalid', 'authenticated', 'authenticated'
  from unnest(array[u_p, u_t, u_i, u_ib, u_is, u_nc, u_x, u_n]) id;
  insert into public.billing_invoice_stations (name, provider, location_id, active)
    values ('RLS test station A', 'rlstest', '900000001', true) returning id into st_a;
  insert into public.billing_invoice_stations (name, provider, location_id, active)
    values ('RLS test station B', 'rlstest', '900000002', true) returning id into st_b;
  insert into public.admin_users (user_id, role, active, access, modules, station_ids) values
    (u_p, 'admin', true, 'partner', '{overview}', '{}'),
    (u_t, 'admin', true, 'it_admin', '{overview}', '{}'),
    (u_i, 'admin', true, 'investor', '{overview,cms,enquiries,cpo-settings}', '{}'),
    (u_ib, 'admin', true, 'investor', '{overview,cms,billing}', '{}'),
    (u_is, 'admin', true, 'investor', '{overview,cms,enquiries}', array[st_a]),
    (u_nc, 'admin', true, 'investor', '{overview,enquiries}', '{}'),
    (u_x, 'admin', false, 'partner', '{overview}', '{}');
  insert into public.billing_customers (name) values ('RLS test customer') returning id into cust;
  insert into public.billing_invoices (invoice_number, customer_id, billing_name)
    values ('RLSTEST-' || gen_random_uuid(), cust, 'RLS test customer') returning id into inv;
  insert into public.enquiries (name, email, message) values ('RLS test', 'rls@test.invalid', 'test') returning id into enq;
  -- Session mobiles: 0000000001 charges at station A, 0000000003 at station B; 0000000002 never charges.
  insert into public.cms_transactions (transaction_id, provider, location_id, started_at, mobile) values
    (tx_a, 'rlstest', 900000001, now(), '+91 00000 00001'), (tx_b, 'rlstest', 900000002, now(), '0000000003');
  -- Its own platform row, so the test never changes a real one.
  insert into public.provider_settings (provider, enabled) values ('rlstest', true)
    on conflict (provider) do update set enabled = true;
  insert into public.provider_bills (provider, period_start, period_end, their_energy_kwh)
    values ('rlstest', '2026-10-01T00:00:00+05:30', '2026-10-08T00:00:00+05:30', 100)
    on conflict (provider, period_start) do nothing;
  insert into public.cpo_mobile_numbers (mobile_number, normalized_mobile)
    values ('0000000001', '0000000001'), ('0000000002', '0000000002'), ('0000000003', '0000000003')
    on conflict (normalized_mobile) do nothing;

  -- 1. Visitors (anon) and signed-in non-admins see nothing in the sensitive tables.
  foreach who in array array['anon', 'non-admin', 'inactive partner'] loop
    perform set_config('request.jwt.claims', case who when 'anon' then '{"role":"anon"}'
      else json_build_object('sub', case who when 'non-admin' then u_n else u_x end, 'role', 'authenticated')::text end, true);
    perform set_config('request.jwt.claim.sub', case who when 'anon' then '' when 'non-admin' then u_n::text else u_x::text end, true);
    perform set_config('role', case who when 'anon' then 'anon' else 'authenticated' end, true);
    foreach tbl in array sensitive loop
      begin
        execute format('select count(*) from public.%I', tbl) into n;
      exception when insufficient_privilege then n := 0;
      end;
      total := total + 1;
      if n <> 0 then fails := fails || array[format('%s reads %s rows of %s', who, n, tbl)]; end if;
    end loop;
    total := total + 1;
    begin
      n := (select count(*) from public.cpo_mobile_matches(array['0000000001']));
    exception when insufficient_privilege then n := 0; -- anon may not call it at all
    end;
    if n <> 0 then fails := fails || array[format('%s gets CPO matches', who)]; end if;
    perform set_config('role', 'postgres', true);
  end loop;

  -- 2. Investor (default modules).
  perform set_config('request.jwt.claims', json_build_object('sub', u_i, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_i::text, true);
  perform set_config('role', 'authenticated', true);

  total := total + 1;
  if (select count(*) from public.billing_invoices where id = inv) <> 0 then fails := fails || array['investor reads invoices']; end if;
  total := total + 1;
  begin insert into public.billing_customers (name) values ('RLS test'); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['investor adds a billing customer']; end if;
  total := total + 1;
  if (select count(*) from public.cpo_mobile_numbers) <> 0 then fails := fails || array['investor reads the CPO number list']; end if;
  total := total + 1;
  -- Platforms: every active admin reads, only full access switches one on or off.
  if (select count(*) from public.provider_settings where provider = 'rlstest') <> 1 then fails := fails || array['investor cannot read platforms']; end if;
  total := total + 1;
  update public.provider_settings set enabled = false where provider = 'rlstest'; get diagnostics n = row_count;
  if n <> 0 then fails := fails || array['investor switches a platform off']; end if;
  total := total + 1;
  -- Platform bills: readable by any active admin, confirmable only with full access.
  -- This investor has {overview,cms,enquiries}, so without the module the bill is invisible.
  if (select count(*) from public.provider_bills where provider = 'rlstest') <> 0 then fails := fails || array['investor without the module reads platform bills']; end if;
  total := total + 1;
  update public.provider_bills set status = 'confirmed' where provider = 'rlstest'; get diagnostics n = row_count;
  if n <> 0 then fails := fails || array['investor confirms a platform bill']; end if;
  total := total + 1;
  if (select count(*) from public.cpo_mobile_matches(array['0000000001'])) <> 1 then fails := fails || array['investor cannot match a CPO number on a session'];
  end if;
  total := total + 1;
  if (select count(*) from public.cpo_mobile_matches(array['0000000002'])) <> 0 then fails := fails || array['investor probes a CPO number on no session']; end if;
  -- Investors may add a CPO number (as themselves) but still not read the list.
  total := total + 1;
  begin insert into public.cpo_mobile_numbers (mobile_number, normalized_mobile, created_by) values ('0000000009', '0000000009', u_i); denied := false;
  exception when insufficient_privilege or unique_violation then denied := true; end;
  if denied then fails := fails || array['cpo-settings investor cannot add a CPO number']; end if;
  total := total + 1;
  begin insert into public.cpo_mobile_numbers (mobile_number, normalized_mobile, created_by) values ('0000000008', '0000000008', u_p); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['investor adds a CPO number in another admin''s name']; end if;
  total := total + 1;
  update public.cpo_mobile_numbers set mobile_number = 'x' where normalized_mobile = '0000000001'; get diagnostics n = row_count;
  if n <> 0 then fails := fails || array['investor edits a CPO number']; end if;
  total := total + 1;
  delete from public.cpo_mobile_numbers where normalized_mobile = '0000000001'; get diagnostics n = row_count;
  if n <> 0 then fails := fails || array['investor deletes a CPO number']; end if;
  total := total + 1;
  if (select count(*) from public.enquiries where id = enq) <> 1 then fails := fails || array['investor cannot read enquiries']; end if;
  total := total + 1;
  update public.enquiries set status = 'Contacted' where id = enq; get diagnostics n = row_count;
  if n <> 0 then fails := fails || array['investor changes an enquiry']; end if;
  total := total + 1;
  delete from public.enquiries where id = enq; get diagnostics n = row_count;
  if n <> 0 then fails := fails || array['investor deletes an enquiry']; end if;
  total := total + 1;
  if (select count(*) from public.cms_transactions where transaction_id in (tx_a, tx_b)) <> 2 then fails := fails || array['investor (all stations) misses sessions']; end if;
  total := total + 1;
  begin insert into public.cms_transactions (transaction_id, provider, location_id, started_at) values ('rlstest_i_' || gen_random_uuid(), 'rlstest', 900000002, now()); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['investor adds a session']; end if;
  total := total + 1;
  update public.cms_transactions set energy_kwh = 9999 where transaction_id = tx_a; get diagnostics n = row_count;
  if n <> 0 then fails := fails || array['investor edits a session']; end if;
  total := total + 1;
  if to_regclass('public.charging_sessions') is not null then
    begin execute 'select count(*) from public.charging_sessions' into n;
    exception when insufficient_privilege then n := 0; end;
    if n <> 0 then fails := fails || array['investor reads the old charging_sessions copy']; end if;
  end if;
  total := total + 1;
  if (select count(*) from public.billing_invoice_stations where id in (st_a, st_b)) <> 2 then fails := fails || array['investor cannot read station names']; end if;
  total := total + 1;
  begin update public.billing_invoice_stations set name = 'x' where id = st_a; get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0; end;
  if n <> 0 then fails := fails || array['investor renames a station']; end if;
  total := total + 1;
  begin update public.admin_users set access = 'partner' where user_id = u_i; denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['investor raises own access']; end if;
  total := total + 1;
  begin update public.admin_users set modules = '{billing}' where user_id = u_i; denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['investor ticks own modules']; end if;
  total := total + 1;
  update public.admin_users set cms_operator_columns = '["id"]' where user_id = u_i; get diagnostics n = row_count;
  if n <> 1 then fails := fails || array['investor cannot save own column preferences']; end if;
  total := total + 1;
  update public.admin_users set cms_operator_columns = '["id"]' where user_id = u_p; get diagnostics n = row_count;
  if n <> 0 then fails := fails || array['investor changes another admin''s row']; end if;
  total := total + 1;
  if (select count(*) from public.admin_users) <> 1 then fails := fails || array['investor reads other admin rows']; end if;
  total := total + 1;
  begin perform public.cms_session_acquire(30); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['investor calls cms_session_acquire (ChargeMOD token)']; end if;
  -- Devices and device commands: full-access admins only (migration 20261023000100).
  total := total + 1;
  begin insert into public.devices (name, device_type, device_id) values ('RLS test', 'esp32_s3', 'rlstest-' || gen_random_uuid()); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['investor adds a device']; end if;
  total := total + 1;
  begin insert into public.device_commands (device_id, command) values ('rlstest', 'reboot'); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['investor queues a device command']; end if;
  perform set_config('role', 'postgres', true);

  -- 3. Investor with the billing module, and the station-limited investor.
  perform set_config('request.jwt.claims', json_build_object('sub', u_ib, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_ib::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  -- Billing is full access only: a ticked billing module grants nothing.
  if (select count(*) from public.billing_invoices where id = inv) <> 0 then fails := fails || array['investor with billing ticked reads invoices']; end if;
  total := total + 1;
  begin insert into public.billing_customers (name) values ('RLS test 2'); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['investor with billing ticked adds a customer']; end if;
  total := total + 1;
  begin update public.billing_invoice_stations set name = 'RLS test station A' where id = st_b; get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0; end;
  if n <> 0 then fails := fails || array['investor with billing ticked renames a station']; end if;
  total := total + 1;
  if (select count(*) from public.enquiries where id = enq) <> 0 then fails := fails || array['investor without the enquiries module reads enquiries']; end if;
  perform set_config('role', 'postgres', true);

  -- Without the CMS module the sessions table shows nothing: Overview gets its figures from the server.
  perform set_config('request.jwt.claims', json_build_object('sub', u_nc, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_nc::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  if (select count(*) from public.cms_transactions where transaction_id in (tx_a, tx_b)) <> 0 then fails := fails || array['investor without the cms module reads sessions']; end if;
  total := total + 1;
  if (select count(*) from public.enquiries where id = enq) <> 1 then fails := fails || array['investor with only enquiries misses enquiries']; end if;
  perform set_config('role', 'postgres', true);

  perform set_config('request.jwt.claims', json_build_object('sub', u_is, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_is::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  if (select count(*) from public.cms_transactions where transaction_id = tx_a) <> 1 then fails := fails || array['station-limited investor misses own station']; end if;
  total := total + 1;
  if (select count(*) from public.cms_transactions where transaction_id = tx_b) <> 0 then fails := fails || array['station-limited investor reads another station']; end if;
  total := total + 1;
  update public.cms_transactions set user_name = 'x' where transaction_id = tx_b; get diagnostics n = row_count;
  if n <> 0 then fails := fails || array['station-limited investor updates another station''s session']; end if;
  total := total + 1;
  begin insert into public.cms_transactions (transaction_id, provider, location_id, started_at) values ('rlstest_is_' || gen_random_uuid(), 'rlstest', 900000002, now()); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['station-limited investor adds a session at another station']; end if;
  total := total + 1;
  if (select count(*) from public.cpo_mobile_matches(array['0000000001'])) <> 1 then fails := fails || array['station-limited investor loses the CPO split on own station']; end if;
  total := total + 1;
  if (select count(*) from public.cpo_mobile_matches(array['0000000003'])) <> 0 then fails := fails || array['station-limited investor matches a CPO number from another station']; end if;
  perform set_config('role', 'postgres', true);

  -- 4. Full access: partner and IT admin.
  foreach who in array array['partner', 'IT admin'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', case who when 'partner' then u_p else u_t end, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', case who when 'partner' then u_p::text else u_t::text end, true);
    perform set_config('role', 'authenticated', true);
    total := total + 1;
    if (select count(*) from public.billing_invoices where id = inv) <> 1 then fails := fails || array[format('%s cannot read invoices', who)]; end if;
    total := total + 1;
    if (select count(*) from public.cpo_mobile_numbers where normalized_mobile = '0000000001') <> 1 then fails := fails || array[format('%s cannot read CPO numbers', who)]; end if;
    total := total + 1;
    if (select count(*) from public.cms_transactions where transaction_id in (tx_a, tx_b)) <> 2 then fails := fails || array[format('%s misses sessions', who)]; end if;
    total := total + 1;
    if (select count(*) from public.cpo_mobile_matches(array['0000000002'])) <> 1 then fails := fails || array[format('%s cannot match any CPO number', who)]; end if;
    total := total + 1;
    update public.enquiries set status = 'Contacted' where id = enq; get diagnostics n = row_count;
    if n <> 1 then fails := fails || array[format('%s cannot change an enquiry status', who)]; end if;
    total := total + 1;
    update public.provider_settings set enabled = not enabled where provider = 'rlstest'; get diagnostics n = row_count;
    if n <> 1 then fails := fails || array[format('%s cannot switch a platform', who)]; end if;
    total := total + 1;
    update public.provider_bills set status = 'confirmed' where provider = 'rlstest'; get diagnostics n = row_count;
    if n <> 1 then fails := fails || array[format('%s cannot confirm a platform bill', who)]; end if;
    total := total + 1;
    begin update public.admin_users set access = 'investor' where user_id = u_i; denied := false;
    exception when insufficient_privilege then denied := true; end;
    if not denied then fails := fails || array[format('%s changes admin access from the browser (must go through /api/admin/access)', who)]; end if;
    total := total + 1;
    begin perform public.cms_session_acquire(30); denied := false;
    exception when insufficient_privilege then denied := true; end;
    if not denied then fails := fails || array[format('%s calls cms_session_acquire from a signed-in session', who)]; end if;
    perform set_config('role', 'postgres', true);
  end loop;
  -- Last, since it removes the fixture: a partner may delete an enquiry.
  perform set_config('request.jwt.claims', json_build_object('sub', u_p, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_p::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  delete from public.enquiries where id = enq; get diagnostics n = row_count;
  if n <> 1 then fails := fails || array['partner cannot delete an enquiry']; end if;

  -- Editing an invoice keeps its payment state true (save_billing_invoice).
  update public.billing_invoices set invoice_status = 'paid', amount_paid = 1000, grand_total = 1000 where id = inv;
  perform public.save_billing_invoice(inv, '{"amount_paid": 5, "invoice_status": "paid"}'::jsonb,
    '[{"description": "RLS test", "unit": "kWh", "quantity": 1, "unit_price": 2000, "gst_rate": 18, "tax_type": "CGST_SGST"}]'::jsonb);
  total := total + 1;
  if not exists (select 1 from public.billing_invoices where id = inv and grand_total = 2000 and amount_paid = 1000 and invoice_status = 'partially_paid' and not payment_received)
    then fails := fails || array['raising a paid invoice''s total does not leave it part paid']; end if;
  total := total + 1;
  begin
    perform public.save_billing_invoice(inv, '{}'::jsonb,
      '[{"description": "RLS test", "unit": "kWh", "quantity": 1, "unit_price": 500, "gst_rate": 18, "tax_type": "CGST_SGST"}]'::jsonb);
    denied := false;
  exception when invalid_parameter_value then denied := true; end;
  if not denied then fails := fails || array['an invoice total below what was received is accepted']; end if;
  perform public.save_billing_invoice(inv, '{}'::jsonb,
    '[{"description": "RLS test", "unit": "kWh", "quantity": 1, "unit_price": 1000, "gst_rate": 18, "tax_type": "CGST_SGST"}]'::jsonb);
  total := total + 1;
  if not exists (select 1 from public.billing_invoices where id = inv and grand_total = 1000 and invoice_status = 'paid' and payment_received)
    then fails := fails || array['lowering an invoice total to what was received does not make it paid']; end if;
  -- Those edits are on record: full-access admins read it, nobody can write it.
  total := total + 1;
  if not exists (select 1 from public.billing_invoice_audit where invoice_id = inv and changed_by = u_p and new_row ->> 'invoice_status' = 'partially_paid')
    then fails := fails || array['an invoice edit is not in the audit record']; end if;
  total := total + 1;
  begin delete from public.billing_invoice_audit where invoice_id = inv; denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || array['a partner deletes the invoice audit record']; end if;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_i, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_i::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  if (select count(*) from public.billing_invoice_audit where invoice_id = inv) <> 0 then fails := fails || array['an investor reads the invoice audit record']; end if;
  perform set_config('role', 'postgres', true);

  -- Always roll back: the outcome travels in the exception message.
  if cardinality(fails) = 0 then
    raise exception 'RLS OK: % checks passed.%', total,
      coalesce(' Known gaps: ' || nullif(array_to_string(gaps, '; '), ''), '');
  end if;
  raise exception 'RLS FAILED: % of % checks failed: %.%', cardinality(fails), total, array_to_string(fails, '; '),
    coalesce(' Known gaps: ' || nullif(array_to_string(gaps, '; '), ''), '');
end $$;
