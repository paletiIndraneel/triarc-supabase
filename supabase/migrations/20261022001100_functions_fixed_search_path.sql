-- Security advisor (function_search_path_mutable): pin search_path so a caller's own
-- search_path can't change what these functions resolve. Both already use only fully
-- qualified objects and built-ins, so behaviour is unchanged.
alter function public.next_billing_invoice_number(text) set search_path = '';

-- No trigger uses this any more (its admin_preferences table was dropped on 2026-10-12);
-- kept rather than dropped, pinned so the advisor stops flagging it.
alter function public.set_admin_preferences_updated_at() set search_path = '';
