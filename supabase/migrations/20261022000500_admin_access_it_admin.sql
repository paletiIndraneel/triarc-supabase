-- Multi-station, phase 3, step 1: a third access level. IT admins have full access to the whole
-- admin, like partners (admin_full_access() and the policies follow in 20261022000600).
-- On its own because a new enum value cannot be used in the transaction that adds it.
alter type public.admin_access add value if not exists 'it_admin';
