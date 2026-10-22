-- Review finding: "Active admins can manage enquiries" was FOR ALL, so investor admins could
-- delete enquiries. The admin UI only reads them and changes their status; the contact form
-- inserts through the submit-enquiry Edge Function with the service role (not affected by RLS).
-- Now: active admins read and update, only partners delete, and no admin inserts.
create policy "Active admins can read enquiries" on public.enquiries for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

create policy "Active admins can update enquiries" on public.enquiries for update to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true))
with check (exists (select 1 from public.admin_users au
                    where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

create policy "Partners can delete enquiries" on public.enquiries for delete to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true
                 and au.access = 'partner'));

-- Last, so admins never lose access in between: the old catch-all policy.
drop policy if exists "Active admins can manage enquiries" on public.enquiries;
