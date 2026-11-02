-- Platform-neutral sessions, step 3: a session must name its platform.
-- Every writer sets provider (the connector wrapper stamps it, and upserts carry it), so the old
-- 'chargemod' default is only a trap for a future platform that forgets to set it. Dropping the
-- default changes nothing for existing rows.
alter table public.cms_transactions alter column provider drop default;
