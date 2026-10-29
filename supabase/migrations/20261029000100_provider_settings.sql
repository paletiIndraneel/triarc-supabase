-- Which charging platforms are switched on. Until now a platform was live purely because its
-- env vars existed on the Worker, so freezing ChargeMOD at the Ionage cutover needed a deploy.
-- Partners and IT admins do it themselves from the Platforms page instead.
--
-- Credentials stay on the Worker and never come here: this table only says enabled or not.
-- src/lib/cms/provider.ts requires both, so a row can never start a platform that has no
-- credentials, and credentials alone can never start one nobody enabled.
--
-- Switching a platform off stops fetching only. Its stored sessions in cms_transactions stay,
-- which is what freezing ChargeMOD means.

create table if not exists public.provider_settings (
  provider text primary key,
  enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.provider_settings enable row level security;

-- ChargeMOD is the live platform today, so nothing changes when this ships.
insert into public.provider_settings (provider, enabled) values ('chargemod', true)
  on conflict (provider) do nothing;

-- Every active admin reads (the dashboard needs to know which platforms are live);
-- only full-access admins change it.
drop policy if exists "Active admins can read provider settings" on public.provider_settings;
create policy "Active admins can read provider settings" on public.provider_settings for select to authenticated
using (exists (select 1 from public.admin_users au
               where au.user_id = (select auth.uid()) and au.role = 'admin' and au.active = true));

drop policy if exists "Full-access admins can manage provider settings" on public.provider_settings;
create policy "Full-access admins can manage provider settings" on public.provider_settings for all to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));

-- Visitors never touch it.
revoke insert, update, delete on public.provider_settings from anon;
