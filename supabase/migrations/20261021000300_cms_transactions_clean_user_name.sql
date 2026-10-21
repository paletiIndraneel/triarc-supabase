-- ChargeMOD sent names like "Guest User undefined"; new syncs clean them (cleanUserName in
-- src/lib/cms/transactionStore.ts). This applies the same rule to the rows already stored.
update public.cms_transactions
set user_name = coalesce(
  nullif(btrim(regexp_replace(regexp_replace(user_name, '(^|\s)(undefined|null)(?=\s|$)', ' ', 'gi'), '\s+', ' ', 'g')), ''),
  'Unknown'
)
where user_name ~* '(^|\s)(undefined|null)(\s|$)' or user_name ~ '\s{2,}' or user_name <> btrim(user_name);
