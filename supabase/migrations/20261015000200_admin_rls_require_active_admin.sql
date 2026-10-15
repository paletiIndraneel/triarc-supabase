-- The billing_* policies (created before these migrations) only checked that an
-- admin_users row exists, and enquiries/billing_inventory skipped the role check, so a
-- deactivated admin who could still sign in kept full access through PostgREST.
-- Replace them with the same condition proxy.ts and getAdminClient use:
-- role = 'admin' AND active = true. Anonymous users never need these tables
-- (the contact form inserts enquiries through the Edge Function's service role).
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'billing_customers', 'billing_inventory', 'billing_invoice_series', 'billing_invoice_settings',
    'billing_invoice_stations', 'billing_invoices', 'billing_items', 'billing_place_of_supply', 'enquiries'
  ] loop
    -- billing_invoice_series is dropped by 20261015000100 once the live site stops using it.
    continue when to_regclass('public.' || t) is null;

    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      $f$create policy "Active admins can manage %1$s" on public.%1$I for all to authenticated
        using (exists (select 1 from public.admin_users au
                       where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true))
        with check (exists (select 1 from public.admin_users au
                            where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true))$f$,
      t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
