-- Two access levels inside the admin area (role = 'admin' still decides who can sign in):
--   partner:  everything (billing, CPO Settings, CMS dashboard, enquiries)
--   investor: CMS dashboard and enquiries only; can read CPO numbers (the dashboard uses
--             them) but not change them, and has no access to billing_* at all.
-- New admins default to investor. Access is set by hand in the SQL editor: admins can only
-- update cms_operator_columns on their own row (20261014000200).
alter table public.admin_users
  add column if not exists access text not null default 'investor'
  constraint admin_users_access_check check (access in ('partner', 'investor'));

-- Everyone who is an admin today is a partner.
update public.admin_users set access = 'partner' where role = 'admin';

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'billing_customers', 'billing_inventory', 'billing_invoice_series', 'billing_invoice_settings',
    'billing_invoice_stations', 'billing_invoices', 'billing_items', 'billing_place_of_supply'
  ] loop
    continue when to_regclass('public.' || t) is null;

    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      $f$create policy "Partners can manage %1$s" on public.%1$I for all to authenticated
        using (exists (select 1 from public.admin_users au
                       where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                         and au.access = 'partner'))
        with check (exists (select 1 from public.admin_users au
                            where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                              and au.access = 'partner'))$f$,
      t);
  end loop;
end $$;

-- CPO numbers: any active admin reads, partners change.
drop policy if exists "Admins can read CPO mobile numbers" on public.cpo_mobile_numbers;
create policy "Admins can read CPO mobile numbers" on public.cpo_mobile_numbers for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

drop policy if exists "Admins can add CPO mobile numbers" on public.cpo_mobile_numbers;
create policy "Partners can add CPO mobile numbers" on public.cpo_mobile_numbers for insert to authenticated
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                      and au.access = 'partner'));

drop policy if exists "Admins can update CPO mobile numbers" on public.cpo_mobile_numbers;
create policy "Partners can update CPO mobile numbers" on public.cpo_mobile_numbers for update to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                 and au.access = 'partner'))
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                      and au.access = 'partner'));

drop policy if exists "Admins can delete CPO mobile numbers" on public.cpo_mobile_numbers;
create policy "Partners can delete CPO mobile numbers" on public.cpo_mobile_numbers for delete to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                 and au.access = 'partner'));
