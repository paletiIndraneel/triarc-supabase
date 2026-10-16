-- admin_users.access becomes an enum so the Supabase Table Editor offers a partner/investor
-- dropdown instead of free text. Postgres can't change the type of a column that policies
-- reference, so the partner policies from 20261016000100 are dropped and recreated unchanged.
do $$ begin
  create type public.admin_access as enum ('partner', 'investor');
exception when duplicate_object then null;
end $$;

drop policy if exists "Partners can add CPO mobile numbers" on public.cpo_mobile_numbers;
drop policy if exists "Partners can update CPO mobile numbers" on public.cpo_mobile_numbers;
drop policy if exists "Partners can delete CPO mobile numbers" on public.cpo_mobile_numbers;
do $$
declare t text;
begin
  foreach t in array array[
    'billing_customers', 'billing_inventory', 'billing_invoice_series', 'billing_invoice_settings',
    'billing_invoice_stations', 'billing_invoices', 'billing_items', 'billing_place_of_supply'
  ] loop
    continue when to_regclass('public.' || t) is null;
    execute format('drop policy if exists %I on public.%I', 'Partners can manage ' || t, t);
  end loop;
end $$;

alter table public.admin_users drop constraint if exists admin_users_access_check;
alter table public.admin_users alter column access drop default;
alter table public.admin_users alter column access type public.admin_access using access::public.admin_access;
alter table public.admin_users alter column access set default 'investor';

do $$
declare t text;
begin
  foreach t in array array[
    'billing_customers', 'billing_inventory', 'billing_invoice_series', 'billing_invoice_settings',
    'billing_invoice_stations', 'billing_invoices', 'billing_items', 'billing_place_of_supply'
  ] loop
    continue when to_regclass('public.' || t) is null;
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

create policy "Partners can add CPO mobile numbers" on public.cpo_mobile_numbers for insert to authenticated
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                      and au.access = 'partner'));
create policy "Partners can update CPO mobile numbers" on public.cpo_mobile_numbers for update to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                 and au.access = 'partner'))
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                      and au.access = 'partner'));
create policy "Partners can delete CPO mobile numbers" on public.cpo_mobile_numbers for delete to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                 and au.access = 'partner'));
