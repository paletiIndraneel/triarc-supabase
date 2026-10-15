-- The invoice series now lives in billing_invoice_settings.series; nothing references
-- this table (no FKs, functions or views). Apply only after the live site stops reading it.
drop table if exists public.billing_invoice_series;
