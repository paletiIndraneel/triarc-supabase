-- The invoice series now lives in billing_invoice_settings.series; nothing references
-- this table (no FKs, functions or views). The live site has no admin area, so it is safe to apply.
drop table if exists public.billing_invoice_series;
