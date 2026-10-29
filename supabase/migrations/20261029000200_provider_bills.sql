-- Bills the charging platform sends Triarc, and whether Triarc has agreed them.
--
-- Everything else in this database is Triarc billing its customers. This is the other
-- direction: Ionage auto-generates a bill in Triarc's name every 7 days (payment T+3), emails
-- it as a PDF or spreadsheet, and Triarc has to check the line items and quantities before
-- confirming. They also charge a commission per kWh of customer energy.
--
-- "their_" columns are keyed in from that document. "our_" columns are what the admin works out
-- from cms_transactions over the same cycle, so the two can be compared. Only the figures are
-- kept, never the document.

create table if not exists public.provider_bills (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  -- The cycle this bill covers, as @/lib/billingCycle draws it; period_end is exclusive.
  period_start timestamptz not null,
  period_end timestamptz not null,
  -- When payment is due (Ionage: period_end + 3 days). Null until known.
  payment_due date,
  -- From the platform's document.
  their_energy_kwh numeric(14, 4),
  their_amount numeric(14, 2),
  their_commission numeric(14, 2),
  -- What the admin computed from the stored sessions when the bill was last looked at.
  our_energy_kwh numeric(14, 4),
  our_amount numeric(14, 2),
  our_commission numeric(14, 2),
  status text not null default 'pending',
  note text,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_bills_one_per_cycle unique (provider, period_start),
  constraint provider_bills_period_order check (period_end > period_start),
  constraint provider_bills_status check (status in ('pending', 'confirmed', 'disputed'))
);
alter table public.provider_bills enable row level security;

-- Admins with the Platform Bills module read; only full-access admins (partner, IT admin)
-- record or confirm a bill, since confirming one commits Triarc to paying it.
-- admin_has_module() is already true for full access, so this one policy matches the API check
-- (isPartner || modules.includes("provider-bills")) exactly — the same shape billing_invoices
-- and cpo_mobile_numbers use. Not "any active admin": these tables are reachable from the
-- browser through the client-side Supabase singleton, so RLS must not be looser than the route.
drop policy if exists "Active admins can read provider bills" on public.provider_bills;
drop policy if exists "Platform-bills-module admins can read provider bills" on public.provider_bills;
create policy "Platform-bills-module admins can read provider bills" on public.provider_bills for select to authenticated
using ((select public.admin_has_module('provider-bills')));

drop policy if exists "Full-access admins can manage provider bills" on public.provider_bills;
create policy "Full-access admins can manage provider bills" on public.provider_bills for all to authenticated
using ((select public.admin_full_access())) with check ((select public.admin_full_access()));

-- Visitors never touch it.
revoke insert, update, delete on public.provider_bills from anon;

create index if not exists provider_bills_provider_period_idx
  on public.provider_bills (provider, period_start desc);
