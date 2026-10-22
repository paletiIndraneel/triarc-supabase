-- Multi-station, phase 3, step 3: station access lives on admin_users (station_ids: the
-- stations an admin is limited to; empty = all stations), replacing the separate
-- admin_station_access table from 20261022000600 (never used; drop it separately). The role is
-- the admin_access picklist (admin_users.access); the Access page reads its values from
-- admin_access_levels(), so a value added to the picklist appears there without a code change.
-- Signed-in admins have UPDATE only on cms_operator_columns, so station_ids is written by the
-- server (Access page, secret key) alone.
alter table public.admin_users add column if not exists station_ids uuid[] not null default '{}';

create or replace function public.admin_can_see_location(p_provider text, p_location_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.admin_full_access())
      or exists (select 1 from public.admin_users au
                 where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                   and (cardinality(au.station_ids) = 0
                        or exists (select 1 from public.station_locations sl
                                   where sl.station_id = any (au.station_ids)
                                     and sl.provider = p_provider and sl.location_id = p_location_id)));
$$;

-- The picklist's values, in order.
create or replace function public.admin_access_levels()
returns text[]
language sql
stable
set search_path = ''
as $$
  select enum_range(null::public.admin_access)::text[];
$$;
revoke all on function public.admin_access_levels() from public, anon;
grant execute on function public.admin_access_levels() to authenticated, service_role;
