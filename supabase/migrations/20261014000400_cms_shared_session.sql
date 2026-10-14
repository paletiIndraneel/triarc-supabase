-- One ChargeMOD login shared by every server instance (Cloudflare isolates, Vercel
-- functions). Before this, each instance cached its own token in memory, so parallel
-- dashboard requests logged in several times and used up ChargeMOD device slots.
--
-- The table has no policies: it is only reachable through the functions below, which
-- require an active admin (the /api/cms route calls them with the admin's session).
create table if not exists public.cms_session (
  id smallint primary key default 1 constraint cms_session_single_row check (id = 1),
  access_token text,
  expires_at timestamptz,
  location_ids integer[],
  login_lease_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.cms_session enable row level security;
revoke all on public.cms_session from anon, authenticated;
insert into public.cms_session (id) values (1) on conflict (id) do nothing;

create or replace function public.cms_session_require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
  ) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
end;
$$;

-- Returns {token, expires_at, location_ids} when a usable token exists. Otherwise the
-- first caller gets {lease: true} and must log in and call cms_session_store; everyone
-- else gets {wait: true} and polls again. A lease expires on its own if its holder dies.
create or replace function public.cms_session_acquire(p_lease_seconds integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.cms_session;
begin
  perform public.cms_session_require_admin();
  select * into s from public.cms_session where id = 1 for update;

  if s.access_token is not null and s.expires_at > now() + interval '2 minutes' then
    return jsonb_build_object('token', s.access_token, 'expires_at', s.expires_at, 'location_ids', s.location_ids);
  end if;

  if s.login_lease_until is null or s.login_lease_until < now() then
    update public.cms_session
    set login_lease_until = now() + make_interval(secs => least(greatest(p_lease_seconds, 5), 120))
    where id = 1;
    -- The old token is still needed to clear stale sessions on a device-limit response.
    return jsonb_build_object('lease', true, 'previous_token', s.access_token);
  end if;

  return jsonb_build_object('wait', true);
end;
$$;

create or replace function public.cms_session_store(p_token text, p_expires_at timestamptz, p_location_ids integer[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.cms_session_require_admin();
  update public.cms_session
  set access_token = p_token, expires_at = p_expires_at, location_ids = p_location_ids,
      login_lease_until = null, updated_at = now()
  where id = 1;
end;
$$;

-- Clears the token only if it is still the one the caller saw rejected, so a newer
-- token stored by another instance survives. Also releases a failed login's lease.
create or replace function public.cms_session_invalidate(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.cms_session_require_admin();
  update public.cms_session
  set access_token = case when access_token = p_token then null else access_token end,
      expires_at = case when access_token = p_token then null else expires_at end,
      login_lease_until = null, updated_at = now()
  where id = 1;
end;
$$;

revoke execute on function public.cms_session_require_admin() from public, anon, authenticated;
revoke execute on function public.cms_session_acquire(integer) from public, anon;
revoke execute on function public.cms_session_store(text, timestamptz, integer[]) from public, anon;
revoke execute on function public.cms_session_invalidate(text) from public, anon;
grant execute on function public.cms_session_acquire(integer) to authenticated;
grant execute on function public.cms_session_store(text, timestamptz, integer[]) to authenticated;
grant execute on function public.cms_session_invalidate(text) to authenticated;
