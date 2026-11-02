-- Platform-neutral sessions, step 1 of 3 (additive, reversible).
-- site_id: the platform's site identifier as text, so a platform with non-numeric or no site ids
--          can be stored. Backfilled from location_id; the views and access functions still read
--          location_id until the code writes site_id (step 2).
-- raw:     the platform's own fields we do not model, kept as JSON so a new platform never needs a
--          column. Nothing reads it yet.
-- Nothing is dropped and no default is changed here.

alter table public.cms_transactions add column if not exists site_id text;
alter table public.cms_transactions add column if not exists raw jsonb;

update public.cms_transactions
   set site_id = location_id::text
 where site_id is null and location_id is not null;

create index if not exists cms_transactions_site_idx on public.cms_transactions (provider, site_id);
