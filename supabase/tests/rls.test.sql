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
  u_i uuid := gen_random_uuid();   -- investor, default modules (overview, cms, enquiries)
  u_ib uuid := gen_random_uuid();  -- investor with the billing module ticked
  u_is uuid := gen_random_uuid();  -- investor limited to station A
  u_x uuid := gen_random_uuid();   -- inactive partner
  u_n uuid := gen_random_uuid();   -- signed in, not an admin
  st_a uuid; st_b uuid; cust uuid; inv uuid; enq uuid;
  tx_a text := 'rlstest_a_' || gen_random_uuid();
  tx_b text := 'rlstest_b_' || gen_random_uuid();
  tbl text; who text; n bigint; denied boolean;
  total int := 0; fails text[] := '{}'; gaps text[] := '{}';
  sensitive text[] := array['enquiries', 'billing_invoices', 'billing_customers', 'billing_items',
    'cms_transactions', 'cpo_mobile_numbers', 'admin_users', 'cms_session', 'devices', 'device_commands'];
begin
  -- Fixtures, as the database owner.
  insert into auth.users (id, email, aud, role)
  select id, 'rls-' || id || '@test.invalid', 'authenticated', 'authenticated'
  from unnest(array[u_p, u_t, u_i, u_ib, u_is, u_x, u_n]) id;
  insert into public.billing_invoice_stations (name, provider, location_id, active)
    values ('RLS test station A', 'rlstest', '900000001', true) returning id into st_a;
  insert into public.billing_invoice_stations (name, provider, location_id, active)
    values ('RLS test station B', 'rlstest', '900000002', true) returning id into st_b;
  insert into public.admin_users (user_id, role, active, access, modules, station_ids) values
    (u_p, 'admin', true, 'partner', '{overview}', '{}'),
    (u_t, 'admin', true, 'it_admin', '{overview}', '{}'),
    (u_i, 'admin', true, 'investor', '{overview,cms,enquiries}', '{}'),
    (u_ib, 'admin', true, 'investor', '{overview,cms,enquiries,billing}', '{}'),
    (u_is, 'admin', true, 'investor', '{overview,cms,enquiries}', array[st_a]),
    (u_x, 'admin', false, 'partner', '{overview}', '{}');
  insert into public.billing_customers (name) values ('RLS test customer') returning id into cust;
  insert into public.billing_invoices (invoice_number, customer_id, billing_name)
    values ('RLSTEST-' || gen_random_uuid(), cust, 'RLS test customer') returning id into inv;
  insert into public.enquiries (name, email, message) values ('RLS test', 'rls@test.invalid', 'test') returning id into enq;
  insert into public.cms_transactions (transaction_id, provider, location_id, started_at) values
    (tx_a, 'rlstest', 900000001, now()), (tx_b, 'rlstest', 900000002, now());
  insert into public.cpo_mobile_numbers (mobile_number, normalized_mobile)
    values ('0000000001', '0000000001') on conflict (normalized_mobile) do nothing;

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
      if n <> 0 then fails := fails || format('%s reads %s rows of %s', who, n, tbl); end if;
    end loop;
    total := total + 1;
    if (select count(*) from public.cpo_mobile_matches(array['0000000001'])) <> 0 then
      fails := fails || format('%s gets CPO matches', who);
    end if;
    perform set_config('role', 'postgres', true);
  end loop;

  -- 2. Investor (default modules).
  perform set_config('request.jwt.claims', json_build_object('sub', u_i, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_i::text, true);
  perform set_config('role', 'authenticated', true);

  total := total + 1;
  if (select count(*) from public.billing_invoices where id = inv) <> 0 then fails := fails || 'investor reads invoices'; end if;
  total := total + 1;
  begin insert into public.billing_customers (name) values ('RLS test'); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || 'investor adds a billing customer'; end if;
  total := total + 1;
  if (select count(*) from public.cpo_mobile_numbers) <> 0 then fails := fails || 'investor reads the CPO number list'; end if;
  total := total + 1;
  if (select count(*) from public.cpo_mobile_matches(array['0000000001'])) <> 1 then fails := fails || 'investor cannot match a CPO number'; end if;
  total := total + 1;
  if (select count(*) from public.enquiries where id = enq) <> 1 then fails := fails || 'investor cannot read enquiries'; end if;
  total := total + 1;
  update public.enquiries set status = 'Contacted' where id = enq; get diagnostics n = row_count;
  if n <> 1 then fails := fails || 'investor cannot change an enquiry status'; end if;
  total := total + 1;
  delete from public.enquiries where id = enq; get diagnostics n = row_count;
  if n <> 0 then fails := fails || 'investor deletes an enquiry'; end if;
  total := total + 1;
  if (select count(*) from public.cms_transactions where transaction_id in (tx_a, tx_b)) <> 2 then fails := fails || 'investor (all stations) misses sessions'; end if;
  total := total + 1;
  if (select count(*) from public.billing_invoice_stations where id in (st_a, st_b)) <> 2 then fails := fails || 'investor cannot read station names'; end if;
  total := total + 1;
  begin update public.billing_invoice_stations set name = 'x' where id = st_a; get diagnostics n = row_count;
  exception when insufficient_privilege then n := 0; end;
  if n <> 0 then fails := fails || 'investor renames a station'; end if;
  total := total + 1;
  begin update public.admin_users set access = 'partner' where user_id = u_i; denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || 'investor raises own access'; end if;
  total := total + 1;
  begin update public.admin_users set modules = '{billing}' where user_id = u_i; denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || 'investor ticks own modules'; end if;
  total := total + 1;
  update public.admin_users set cms_operator_columns = '["id"]' where user_id = u_i; get diagnostics n = row_count;
  if n <> 1 then fails := fails || 'investor cannot save own column preferences'; end if;
  total := total + 1;
  update public.admin_users set cms_operator_columns = '["id"]' where user_id = u_p; get diagnostics n = row_count;
  if n <> 0 then fails := fails || 'investor changes another admin''s row'; end if;
  total := total + 1;
  if (select count(*) from public.admin_users) <> 1 then fails := fails || 'investor reads other admin rows'; end if;
  total := total + 1;
  begin perform public.cms_session_acquire(30); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then fails := fails || 'investor calls cms_session_acquire (ChargeMOD token)'; end if;
  -- Known gap: device tables let any active admin write (devices, device_commands).
  begin insert into public.devices (name, device_type, device_id) values ('RLS test', 'test', 'rlstest-' || gen_random_uuid()); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if not denied then gaps := gaps || 'investor can add devices / device commands (limit to full access)'; end if;
  perform set_config('role', 'postgres', true);

  -- 3. Investor with the billing module, and the station-limited investor.
  perform set_config('request.jwt.claims', json_build_object('sub', u_ib, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_ib::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  if (select count(*) from public.billing_invoices where id = inv) <> 1 then fails := fails || 'billing-module investor cannot read invoices'; end if;
  total := total + 1;
  begin insert into public.billing_customers (name) values ('RLS test 2'); denied := false;
  exception when insufficient_privilege then denied := true; end;
  if denied then fails := fails || 'billing-module investor cannot add a customer'; end if;
  perform set_config('role', 'postgres', true);

  perform set_config('request.jwt.claims', json_build_object('sub', u_is, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_is::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  if (select count(*) from public.cms_transactions where transaction_id = tx_a) <> 1 then fails := fails || 'station-limited investor misses own station'; end if;
  total := total + 1;
  if (select count(*) from public.cms_transactions where transaction_id = tx_b) <> 0 then fails := fails || 'station-limited investor reads another station'; end if;
  total := total + 1;
  update public.cms_transactions set user_name = 'x' where transaction_id = tx_b; get diagnostics n = row_count;
  if n <> 0 then fails := fails || 'station-limited investor updates another station''s session'; end if;
  perform set_config('role', 'postgres', true);

  -- 4. Full access: partner and IT admin.
  foreach who in array array['partner', 'IT admin'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', case who when 'partner' then u_p else u_t end, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', case who when 'partner' then u_p::text else u_t::text end, true);
    perform set_config('role', 'authenticated', true);
    total := total + 1;
    if (select count(*) from public.billing_invoices where id = inv) <> 1 then fails := fails || format('%s cannot read invoices', who); end if;
    total := total + 1;
    if (select count(*) from public.cpo_mobile_numbers where normalized_mobile = '0000000001') <> 1 then fails := fails || format('%s cannot read CPO numbers', who); end if;
    total := total + 1;
    if (select count(*) from public.cms_transactions where transaction_id in (tx_a, tx_b)) <> 2 then fails := fails || format('%s misses sessions', who); end if;
    total := total + 1;
    begin update public.admin_users set access = 'investor' where user_id = u_i; denied := false;
    exception when insufficient_privilege then denied := true; end;
    if not denied then fails := fails || format('%s changes admin access from the browser (must go through /api/admin/access)', who); end if;
    total := total + 1;
    begin perform public.cms_session_acquire(30); denied := false;
    exception when insufficient_privilege then denied := true; end;
    if not denied then fails := fails || format('%s calls cms_session_acquire from a signed-in session', who); end if;
    perform set_config('role', 'postgres', true);
  end loop;
  -- Last, since it removes the fixture: a partner may delete an enquiry.
  perform set_config('request.jwt.claims', json_build_object('sub', u_p, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_p::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  delete from public.enquiries where id = enq; get diagnostics n = row_count;
  if n <> 1 then fails := fails || 'partner cannot delete an enquiry'; end if;
  perform set_config('role', 'postgres', true);

  -- Always roll back: the outcome travels in the exception message.
  if cardinality(fails) = 0 then
    raise exception 'RLS OK: % checks passed.%', total,
      coalesce(' Known gaps: ' || nullif(array_to_string(gaps, '; '), ''), '');
  end if;
  raise exception 'RLS FAILED: % of % checks failed: %.%', cardinality(fails), total, array_to_string(fails, '; '),
    coalesce(' Known gaps: ' || nullif(array_to_string(gaps, '; '), ''), '');
end $$;
