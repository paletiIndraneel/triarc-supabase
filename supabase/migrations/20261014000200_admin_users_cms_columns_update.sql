-- CMS column preferences live in admin_users.cms_operator_columns (moved there from the
-- dropped admin_preferences table on 2026-10-12). Let each active admin update that
-- column on their own row, and nothing else on admin_users.
revoke update on public.admin_users from anon, authenticated;
grant update (cms_operator_columns) on public.admin_users to authenticated;

drop policy if exists "Admins can update own CMS columns" on public.admin_users;
create policy "Admins can update own CMS columns" on public.admin_users for update to authenticated
using (user_id = (select auth.uid()) and role = 'admin' and active = true)
with check (user_id = (select auth.uid()) and role = 'admin' and active = true);

alter table public.admin_users
  add constraint admin_users_cms_operator_columns_is_array check (jsonb_typeof(cms_operator_columns) = 'array');
