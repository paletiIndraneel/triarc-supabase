create table if not exists public.cpo_mobile_numbers (
  id uuid primary key default gen_random_uuid(),
  mobile_number text not null,
  normalized_mobile text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cpo_mobile_numbers_normalized_indian_mobile check (normalized_mobile ~ '^[0-9]{10}$')
);
alter table public.cpo_mobile_numbers enable row level security;

drop policy if exists "Admins can read CPO mobile numbers" on public.cpo_mobile_numbers;
create policy "Admins can read CPO mobile numbers" on public.cpo_mobile_numbers for select to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'admin' and au.active = true));

drop policy if exists "Admins can add CPO mobile numbers" on public.cpo_mobile_numbers;
create policy "Admins can add CPO mobile numbers" on public.cpo_mobile_numbers for insert to authenticated
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'admin' and au.active = true));

drop policy if exists "Admins can update CPO mobile numbers" on public.cpo_mobile_numbers;
create policy "Admins can update CPO mobile numbers" on public.cpo_mobile_numbers for update to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'admin' and au.active = true))
with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'admin' and au.active = true));

drop policy if exists "Admins can delete CPO mobile numbers" on public.cpo_mobile_numbers;
create policy "Admins can delete CPO mobile numbers" on public.cpo_mobile_numbers for delete to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = auth.uid() and au.role = 'admin' and au.active = true));

create index if not exists cpo_mobile_numbers_normalized_mobile_idx on public.cpo_mobile_numbers (normalized_mobile);
