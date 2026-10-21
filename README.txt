CHARGING PLATFORMS (CMS) AND THE SESSIONS TABLE
================================================

The admin (CMS dashboard, Overview, billing suggestions) can show charging sessions from
more than one charging platform (CMS), e.g. ChargeMOD today and Ather later. Adding or
removing a platform does not change the dashboard, Overview or billing.


1. WHICH TABLE HOLDS THE SESSIONS
---------------------------------

  charging_sessions   used by the app now. Sessions from every platform, with a
                      `provider` column. Session ids carry the platform's prefix, e.g.
                      chrgmod_1792591530932__16183870.
                      Created 2026-10-21 by supabase/migrations/20261021000600_charging_sessions.sql
                      as a copy of cms_transactions (1,600 rows).

  cms_transactions    the earlier ChargeMOD-only table (ids without prefix). Left
                      untouched. The app no longer reads or writes it.

The table name is set in ONE place:

    src/lib/cms/transactionStore.ts
        export const SESSIONS_TABLE = "charging_sessions";

Everything that reads or writes sessions uses it: /api/cms/operator (sync), /api/cms/live
(live readings), /api/cms/live/backfill, the CMS dashboard's stored copy, and the New Bill
session suggestion.


2. HOW TO CHANGE THE TABLE REFERENCE LATER
------------------------------------------

a) Keep charging_sessions for good (once tested):
   nothing to change in code. cms_transactions can stay as an archive.

b) Go back to cms_transactions (if charging_sessions did not work out):
   - Revert the multi-platform commit (git revert <commit>). A plain switch of
     SESSIONS_TABLE is not enough: that table has no `provider` column and its ids have
     no prefix.
   - Sessions synced into charging_sessions meanwhile are fetched again from ChargeMOD by
     the normal delta sync; meter readings for them come back with the backfill button.

c) Point the app at another table (e.g. a renamed one):
   - Create it with the same columns as charging_sessions (including `provider`) and the
     same RLS policies (see the migration above).
   - Copy the rows: INSERT INTO new_table (<column list>) SELECT <column list> FROM
     charging_sessions;  (list the columns; do not use (jsonb_populate_record(...)).* - it
     timed out on this table).
   - Change SESSIONS_TABLE to the new name, run `npm run build`, push.


3. HOW TO ADD A PLATFORM (e.g. Ather)
-------------------------------------

   1. src/lib/cms/providerIds.ts: add it to PROVIDERS, e.g.
          { id: "ather", label: "Ather", idPrefix: "ather_" }
      `id` is stored on sessions and on billing customers; `idPrefix` (its name, short)
      keeps its session ids from clashing with another platform's. Prefixes must differ.

   2. src/lib/cms/ather.ts: a connector, copied from src/lib/cms/chargemod.ts. It reads
      its own env vars (e.g. ATHER_API_URL, ATHER_API_KEY) and returns null from connect()
      when they are missing, so the platform is simply off. It returns:
        - fetchSessions(): sessions as CmsTransaction (src/lib/cms/types.ts). Map the
          platform's fields; set `type: "CPO"` on its own-use sessions; use a session id
          the platform guarantees is unique (or build one, e.g. charger + gun + start time).
        - fetchMeterReadings() (optional): MeterReading[] (src/lib/cms/liveMetrics.ts).
          Leave it out if the platform has no live readings.
      Ids it receives and returns are the platform's own: the prefix is added and removed
      for it (src/lib/cms/provider.ts), so its API always gets its own id back.

   3. src/lib/cms/provider.ts: add it to CONNECTORS:  { chargemod, ather }

   4. Env vars: add them in Vercel and as Cloudflare Worker variables/secrets.

   5. Billing: customers can then pick it under "Charging sessions from". The database
      only allows the values in the billing_customers_session_source_check constraint
      ('chargemod', 'ather'); a platform with another id (e.g. 'statiq') needs that
      constraint widened in a new migration.

   To remove a platform: delete it from PROVIDERS and CONNECTORS (or just remove its env
   vars to switch it off). Its stored sessions stay in the table.
