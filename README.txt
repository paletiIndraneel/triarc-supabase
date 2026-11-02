CHARGING PLATFORMS (CMS) AND THE SESSIONS TABLE
================================================

The admin (CMS dashboard, Overview, billing suggestions) can show charging sessions from
more than one charging platform (CMS), e.g. ChargeMOD today and Ather later. Adding or
removing a platform does not change the dashboard, Overview or billing.


1. WHICH TABLE HOLDS THE SESSIONS
---------------------------------

  cms_transactions    used by the app. Sessions from every platform, with a `provider`
                      column. Session ids carry the platform's prefix, e.g.
                      chrgmod_1792591530932__16183870.
                      Changed 2026-10-21 by
                      supabase/migrations/20261021000700_cms_transactions_multi_platform.sql
                      (provider column added, ids prefixed; no rows removed).

  cms_transactions_backup_20261021
                      safety copy of cms_transactions taken just before that change
                      (1,602 rows, original ids without prefix). Locked: only database
                      admins can read it.

  charging_sessions   the copy used while the multi-platform version was tested
                      (migration 20261021000600). No longer used; can be dropped.

The table name is set in ONE place:

    src/lib/cms/transactionStore.ts
        export const SESSIONS_TABLE = "cms_transactions";

Everything that reads or writes sessions uses it: /api/cms/operator (sync), /api/cms/live
(live readings), /api/cms/live/backfill, the CMS dashboard's stored copy, and the New Bill
session suggestion.


2. HOW TO CHANGE THE TABLE REFERENCE LATER
------------------------------------------

a) Point the app at another table (e.g. a renamed one):
   - Create it with the same columns as cms_transactions (including `provider`) and the
     same RLS policies (copy them from the cms_transactions policies).
   - Copy the rows: INSERT INTO new_table (<column list>) SELECT <column list> FROM
     cms_transactions;  (list the columns; do not use (jsonb_populate_record(...)).* - it
     timed out on this table).
   - Change SESSIONS_TABLE to the new name, run `npm run build`, push.
   - Do it with the CMS dashboard closed, so no session is written to the old table meanwhile
     (the delta sync refetches anything missed anyway).

b) Restore the pre-multi-platform data (ids without prefix):
   - The rows are in cms_transactions_backup_20261021. The code expects prefixed ids, so a
     restore also means reverting the multi-platform commits (git revert).


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

   4. Env vars: add them as Cloudflare Worker variables/secrets.

   5. Billing: customers can then pick it under "Charging sessions from". The database
      only allows the values in the billing_customers_session_source_check constraint
      ('chargemod', 'ather'); a platform with another id (e.g. 'statiq') needs that
      constraint widened in a new migration.

   6. Billing cycle and commission (if they differ from ChargeMOD): src/lib/billingCycle.ts,
      PROVIDER_CYCLES (e.g. { kind: "days", length: 7, anchor: "YYYY-MM-DD" }) and
      PROVIDER_COMMISSION_PER_KWH. Both are keyed by the id from step 1.

   7. Site: the connector sets locationId (the platform's site id). Storage keeps it as
      text in site_id (src/lib/cms/transactionStore.ts). A platform with no site id leaves
      locationId null and its sessions show without a station.

   Note: sessions have no default platform any more (migration 20261104000100 once applied),
   so every session must carry its provider. The connector wrapper in provider.ts sets it.

   To remove a platform: delete it from PROVIDERS and CONNECTORS (or just remove its env
   vars to switch it off). Its stored sessions stay in the table.


