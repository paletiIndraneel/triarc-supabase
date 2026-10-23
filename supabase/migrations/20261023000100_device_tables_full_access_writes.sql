-- Device tables (devices, device_readings, device_health, device_events, device_commands,
-- device_sync_state) were created outside this repo for the ESP32 / Raspberry Pi work, which
-- is not built yet. Until it is, only full-access admins (partner, IT admin) may write
-- devices and device commands from a signed-in session; every active admin still reads.
-- The hardware is expected to write through the server (secret key, bypasses RLS), so this
-- does not block it. No rows are changed.

create policy "Active admins can read devices" on public.devices for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));
create policy "Full-access admins can manage devices" on public.devices for all to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));

create policy "Active admins can read device commands" on public.device_commands for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));
create policy "Full-access admins can manage device commands" on public.device_commands for all to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));

-- Last, so admins never lose read access in between: the old any-admin write policies.
drop policy if exists "Admins can manage devices" on public.devices;
drop policy if exists "Admins can manage device commands" on public.device_commands;

-- Visitors never write device data (RLS already refused them; this matches the other tables).
revoke insert, update, delete on public.devices, public.device_readings, public.device_health,
  public.device_events, public.device_commands, public.device_sync_state from anon;
