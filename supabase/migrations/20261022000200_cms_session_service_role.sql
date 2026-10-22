-- Review finding 1, step 1 of 2: the server now keeps the shared ChargeMOD login (cms_session)
-- with the project's secret key (service_role) instead of the signed-in admin's session, so the
-- token functions must let service_role through. Only adds access; nothing is taken away yet.
-- Step 2 (20261022000300) revokes them from signed-in users once the deployed server uses the key.
create or replace function public.cms_session_require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'service_role' then
    return;
  end if;
  if not exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
  ) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
end;
$$;
