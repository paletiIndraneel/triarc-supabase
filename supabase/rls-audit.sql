-- Read-only Row Level Security audit for the TriArc Supabase project.
-- Paste into the Supabase SQL Editor (it changes nothing). This file lives outside
-- supabase/migrations on purpose, so `supabase db push` never runs it.

-- 1) Tables in `public` WITHOUT row level security. Expected: no rows.
select c.relname as table_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;

-- 2) Every policy. Check each table has only what the app needs:
--    enquiries        -> no anon SELECT/UPDATE/DELETE (inserts go through the Edge Function)
--    admin_users      -> NO insert/update/delete for `authenticated` (otherwise any signed-in
--                        user could make themselves an admin); read only their own row
--    billing_*, ev_assets, admin_preferences -> restricted to active admins (or own row)
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 3) Table privileges granted to the public `anon` role. Expected: very little.
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
order by 1, 2;

-- 4) Functions in `public` that run with the owner's rights (review each one).
select p.proname as function_name, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by 1;
