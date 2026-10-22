# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

We own **only the admin area** (a single page: every module lives at `/admin`, with no `/admin/*` sub-routes): `/admin`, `/signin`, `src/app/admin/`, `src/components/admin/`, `src/app/api/`, `src/lib/cms/`, `src/lib/supabase/`, and the Supabase schema/RLS. The public website (marketing pages, `src/data/`, the other `src/components/` folders) is maintained by another team. Don't change it; flag website issues instead of fixing them.

## Commands

```bash
npm run dev             # Next.js dev server
npm run build           # next build --webpack (webpack, not Turbopack)
npm run lint            # broken: Next 16 removed `next lint` (needs an ESLint flat config)
npm run opennext-build  # build the Cloudflare Worker bundle into .open-next/
npm run preview         # run the Worker bundle locally (wrangler)
npm run deploy          # deploy to Cloudflare (worker "dev-worker", see wrangler.jsonc); only when explicitly asked
```

**Release flow:**
1. Push `development` to GitHub. This triggers a Vercel deployment, which is where changes are tested.
2. Once all current work is done and tested, release to **Cloudflare Workers, the live user-facing site** (built with OpenNext). This is a separate, explicit final step, not part of normal tasks.

Code must run on Cloudflare Workers, not just Vercel: don't rely on Vercel-only features, and keep the `getCloudflareContext` + `process.env` fallback for runtime env. Only push or deploy when asked.

`npm test` runs unit tests for the pure admin helpers (`tests/`, Node's built-in runner: invoice `calc`/`words`, IST date ranges). Verify everything else with `npm run build` (it type-checks).

Env vars: copy `.env.example`. `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_…` key) are required. They have no `NEXT_PUBLIC_` prefix: `next.config.ts` `env` inlines them at build time (so they are still public in the browser bundle and a change needs a rebuild), falling back to the old `NEXT_PUBLIC_SUPABASE_*` names; the `CMS_*` vars enable the optional CMS operator dashboard and are set as Cloudflare Worker variables/secrets in production.

## Architecture

Next.js 16 App Router site (React 19, Tailwind 4, TypeScript) served to users from Cloudflare Workers via OpenNext (Vercel also deploys on push to `development`). Supabase provides auth, Postgres and one Edge Function.

**Public site**: marketing pages under `src/app/` (charging-solutions, ev-station, locations, explore-bhadrachalam, about, contact). Page content lives in `src/data/*.ts`, not in the components. Old `/solutions/*` and `/stations/*` URLs are 301-redirected in `next.config.ts`, which also sets the security headers/CSP.

**Enquiries**: `src/components/Visit/ContactForm.tsx` calls the Supabase Edge Function `supabase/functions/submit-enquiry` (Deno, `auth: "none"`), which validates and size-limits input before inserting into `enquiries`. The form's `maxLength` values must match the function's limits.

**Admin auth is enforced in three layers. Keep all three when adding admin features:**
1. `src/proxy.ts` (Next 16's renamed middleware) guards `/admin/*`: requires a Supabase session *and* an active row in `admin_users` with `role = 'admin'`; otherwise redirects to `/signin` or `/unauthorized`.
2. Each `src/app/api/**/route.ts` re-checks admin by calling `getAdminClient()` from `src/lib/supabase/server.ts` (the proxy matcher does not cover `/api`).
3. RLS policies in Postgres check the same `admin_users` condition (see `supabase/migrations/`, `supabase/rls-audit.sql`).

**Access levels**: `admin_users.access` is `partner` or `it_admin` (both full access: the whole admin) or `investor` (CMS dashboard + enquiries only; new admins default to investor), and a role without full access can be limited to some stations in `admin_users.station_ids` (empty = all stations). The roles are the `admin_access` picklist values, read at run time through `admin_access_levels()` (a new value needs no code change); which roles have full access is `FULL_ACCESS_ROLES` in `src/lib/adminAccess.ts` and the same set in Postgres `admin_full_access()`. It is enforced in all three layers: `canOpenModule` in `adminNavigation.ts` hides/blocks modules (full access opens all; others their ticked `GRANTABLE_MODULES`), `getAdminClient()` returns `isPartner` (= full access), `access` and `stationIds` for API checks (session APIs filter a station-limited investor's results; session writes use the secret-key client), and RLS: the partner-only policies have "Full-access admins" twins, and a restrictive `cms_transactions` select policy (`admin_can_see_location`) limits station-limited investors. Admins are managed on the Access page (`src/app/admin/access/Access.tsx`, `/api/admin/access`, secret key): invite by email (link lands on `/signin/set-password`), change level, active state, modules (`admin_users.modules` check boxes; `canOpenModule`, `admin_has_module()` policies, Overview always open, Access full-access only) and stations (a dropdown multi-select; a picked record stands for every record of that station name); `accessChangeError` stops anyone removing their own full access or the last full-access admin.

**Admin UI** is a single client shell: `/admin` (`src/app/admin/page.tsx`) loads enquiries server-side and renders `src/components/admin/AdminApp.tsx`, which switches modules (overview, the default landing page; cms, billing, enquiries, stations, access, cpo-settings) via `AdminModuleContext` state, not routing; the active module is mirrored in `/admin?module=…` (pushState + popstate) so refresh and Back keep it. **`/admin` is the only admin route**: module components under `src/app/admin/*/` must not be named `page.tsx`, and `next.config.ts` redirects any `/admin/*` URL to `/admin`. Nav items are in `src/components/admin/adminNavigation.ts`.

**Supabase clients**: `src/lib/supabase/server.ts` (cookie-based, for server components/route handlers) and `client.ts` (browser). `billing.ts` exports a browser singleton used by the billing module.

**CMS operator dashboard**: `src/lib/cms/operator.ts` talks to an external charger-management API (chargemod). It reads config from the Cloudflare runtime env (`getCloudflareContext`) with a `process.env` fallback, and shares one ChargeMOD token across all server instances through the `cms_session` table (`cms_session_acquire`/`_store`/`_invalidate` RPCs, called with the admin's session; only the lease holder logs in), with a per-instance memory cache in front. Routes reach charging platforms only through `src/lib/cms/provider.ts` (`getChargingProviders`: one entry per switched-on platform, each with `fetchSessions` and optional `fetchMeterReadings`); platforms are listed in `providerIds.ts` (id, label, session-id prefix such as `chrgmod_`) and each has a connector file (`chargemod.ts`). Adding or removing a platform is described in `README.txt`; meter saves go through `saveMeterReadings` in `transactionStore.ts`. Exposed through `src/app/api/cms/*`; returns 404 when `CMS_OPERATOR_DASHBOARD_ENABLED` is off.

**Shared helpers** in `src/lib/security.ts`: `getSafeCallbackUrl` (open-redirect guard for sign-in callbacks), `neutralizeCsvCell` (CSV export injection), `safeMailtoHref`, `safeTelHref`. Use them rather than reimplementing.

**Database**: schema changes go in `supabase/migrations/` as timestamped SQL; new tables need RLS enabled with admin policies matching the existing pattern.

## Gotchas

- **Billing** (`src/app/admin/billing/EVBilling.jsx`) reads/writes `billing_*` tables directly from the browser via the singleton in `src/lib/supabase/billing.ts`, so RLS is its only guard. Invoice numbers come from the `next_billing_invoice_number` RPC; the PDF layout in `pdf()` mirrors an Excel template (rows A1:G37). GST is CGST+SGST when the customer GSTIN state code is `36` (Telangana), else IGST. Stations are `billing_invoice_stations` records, one per station per charging platform (`provider`, `location_id`, `location_name` columns, unique together); records with the same name are one station (`groupStations` in `transactionFilters.ts`), and the Stations module (`src/app/admin/stations/Stations.tsx`) edits a station's records together, links locations (unlinked ones come from the `session_locations` view) and never deletes (unlinking empties a record). The New Bill suggestion counts the chosen station's record on the customer's platform. `station_locations` and the `platform_locations` column are superseded (to be dropped by hand).
- **CMS data flow**: the dashboard (`src/app/admin/cms/CmsDashboard.tsx`) makes one `/api/cms/operator` call covering previous month + month-to-date, caches rows in `sessionStorage` (`triarc-cms-transaction-cache-v8`) and derives all metrics client-side. Bump the cache key if the `sanitizeTransaction` shape changes; a new field also needs a column in the sessions table.
- **CMS delta sync**: `/api/cms/operator` syncs each platform separately and asks it only for sessions from its newest row in the sessions table (`SESSIONS_TABLE` in `transactionStore.ts`: `cms_transactions`, with a `provider` column and platform-prefixed ids such as `chrgmod_…`; see `README.txt`) onward, or from the oldest stored session still charging (`stopped_at` null, under 2 days old; older open rows are ChargeMOD ghosts and ignored) so it gets its final values, starting one minute early because ChargeMOD omits a session starting exactly at `startDate`; older sessions of the window are read from that table, and an empty table means a full fetch. Active sessions are stored too. Every active admin's load (partner or investor) saves the sessions it fetched, and the dashboard polls meter readings for every charging session (`useLiveMetrics`), which also writes their Energy/SoC into the session's own columns (`meterPatch`: while charging, or only empty columns once finished; `keepMeterValues` stops a sync from wiping them); the history backfill button (`/api/cms/live/backfill`: stage `transactions`, then `meters`, over the previous billing cycle: 1st–15th when pressed on the 16th–month end, else 16th–end of last month) also writes (RLS: insert/update for active admins, delete partner-only). Session types (raw ChargeMOD, sanitized, table row) are in `src/lib/cms/types.ts`; helpers in `src/lib/cms/transactionStore.ts`. `employeeDetails` is never stored (customer ChargeMOD tokens). `loadCmsWindow` first shows a stored copy (the tab's stale cache, else `/api/cms/operator?stored=1`, which reads only the table) and then swaps in the live response.
- `operator.ts` merges CMS and OCPI rows by `transactionId`; OCPI failures are tolerated, CMS failures are not. `currentUsedAmount` is in thousandths of INR (divided by 1000). ChargeMOD hosts `ogs.console.chargemod.com` / `ls.console.chargemod.com` are hardcoded; locations are discovered from the login payload.
- CPO energy on the dashboard is classified by ChargeMOD's `transaction.type` (`"CPO"`) when it is set; only transactions with no type fall back to the CPO Settings numbers, matched through the `cpo_mobile_matches` RPC (`cpoNumbersCache.ts`).
