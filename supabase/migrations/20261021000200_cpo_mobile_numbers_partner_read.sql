-- Security finding: investor admins could read the whole CPO number list. The table is now
-- partner-only; the CMS dashboard instead asks cpo_mobile_matches, which only says which of
-- the mobiles it is given are CPO numbers.
drop policy if exists "Admins can read CPO mobile numbers" on public.cpo_mobile_numbers;
drop policy if exists "Partners can read CPO mobile numbers" on public.cpo_mobile_numbers;
create policy "Partners can read CPO mobile numbers" on public.cpo_mobile_numbers for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                 and au.access = 'partner'));

-- Security definer so investors can match without reading the table. Active admins only,
-- at most 1000 mobiles per call, normalized 10-digit numbers in and out.
create or replace function public.cpo_mobile_matches(p_mobiles text[])
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select c.normalized_mobile
  from public.cpo_mobile_numbers c
  where c.normalized_mobile = any (p_mobiles)
    and cardinality(p_mobiles) <= 1000
    and exists (select 1 from public.admin_users au
                where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true);
$$;

revoke all on function public.cpo_mobile_matches(text[]) from public, anon;
grant execute on function public.cpo_mobile_matches(text[]) to authenticated;
