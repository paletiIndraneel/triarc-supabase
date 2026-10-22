-- Review finding 1, step 2 of 2: signed-in users (any admin, investors included) can no longer
-- call the ChargeMOD token functions, so the token cannot be read or overwritten from a browser.
-- Only the server's secret-key client (service_role) can. Apply only after the deployed server
-- has SUPABASE_SECRET_KEY (step 1: 20261022000200). To undo: grant execute ... to authenticated.
revoke execute on function public.cms_session_acquire(integer) from authenticated, anon, public;
revoke execute on function public.cms_session_store(text, timestamptz, bigint[]) from authenticated, anon, public;
revoke execute on function public.cms_session_invalidate(text) from authenticated, anon, public;
grant execute on function public.cms_session_acquire(integer) to service_role;
grant execute on function public.cms_session_store(text, timestamptz, bigint[]) to service_role;
grant execute on function public.cms_session_invalidate(text) to service_role;
