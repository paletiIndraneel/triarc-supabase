# Triarc Admin — Developer Document

As of 28 Oct 2026. For the business view see [PROJECT.md](PROJECT.md); for short agent-facing rules
see [CLAUDE.md](../CLAUDE.md).

## 1. Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind 4. Built with webpack (`next build --webpack`).
Served to users from Cloudflare Workers via OpenNext. Supabase: Auth, Postgres (RLS), one Deno
Edge Function. jsPDF for invoice PDFs (loaded on demand).

Version ceilings when upgrading: `@opennextjs/cloudflare` needs Next >= 16.4.1, and
`typescript-eslint` (pulled in by `eslint-config-next`) caps TypeScript below 6.1, so TypeScript 7
cannot be used yet.

## 2. Getting started

```bash
npm ci
cp .env.example .env.local      # fill in the values below
npm run dev                     # http://localhost:3000/admin
```

| Variable | Where | Notes |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | build time | Inlined by `next.config.ts` `env`; public; a change needs a rebuild. Falls back to `NEXT_PUBLIC_SUPABASE_*` |
| `SUPABASE_SECRET_KEY` | runtime, server only | `sb_secret_…`, bypasses RLS. Never in `next.config.ts` `env`. Needed for the ChargeMOD login, session writes, Access page |
| `CMS_OPERATOR_DASHBOARD_ENABLED`, `CMS_API_URL`, `CMS_API_USERNAME`, `CMS_API_PASSWORD`, `CMS_OCPI_AUTH_KEY` | runtime | ChargeMOD; dashboard APIs return 404 when disabled |

Runtime env is read through `getRuntimeEnv()` (`lib/cms/operator.ts`): `getCloudflareContext()` for the
Worker's variables and secrets, falling back to `process.env` for `next dev` and the test runners. Keep
that fallback. Build-time values are inlined by `next.config.ts` `env`, so changing them needs a rebuild.

## 3. Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build; also type-checks |
| `npm test` | Node test runner over `tests/*.test.mjs` |
| `npm run lint` | `eslint .` (flat config; React Compiler rules are warnings for now) |
| `npm run opennext-build` / `preview` / `deploy` | Cloudflare Worker build, local run, deploy (deploy only on explicit release) |

## 4. Layout

```text
src/
  app/admin/page.tsx          the only admin route; loads enquiries, renders AdminApp
  app/admin/<module>/         module components (never named page.tsx)
  app/api/admin/*             access, cpo-numbers, preferences
  app/api/cms/*               operator (sync), live/[id] (meter readings), live/backfill
  components/admin/           AdminApp shell, header, navigation, dialogs, sign-in forms
  lib/supabase/               server.ts (cookie client + getAdminClient), client.ts, billing.ts, service.ts
  lib/cms/                    providers, ChargeMOD connector, session store helpers, types
  lib/adminAccess.ts          roles, full-access set, lock-out guard
  lib/security.ts             safe redirect, CSV, mailto/tel helpers
  proxy.ts                    Next 16 middleware: guards /admin
supabase/
  migrations/                 timestamped SQL (see 8)
  functions/submit-enquiry/   public contact-form endpoint
  tests/rls.test.sql          RLS behaviour tests
tests/                        unit, API and RLS test runners
```

## 5. Admin shell

`/admin` is one client component (`AdminApp.tsx`) that switches modules by state, mirrored in
`/admin?module=…` (pushState/popstate). Any `/admin/*` URL redirects to `/admin`. Modules:
`overview`, `cms`, `billing`, `enquiries`, `stations`, `access`, `cpo-settings`
(`adminNavigation.ts`). `canOpenModule(module, isPartner, modules)` decides what shows; a blocked
`?module=` falls back to Overview.

## 6. Access control (keep all three layers)

1. **`src/proxy.ts`**: `/admin` needs a session and an active `admin_users` row (`role = 'admin'`),
   else `/signin` or `/unauthorized`.
2. **Every API route** calls `getAdminClient()` → `{ supabase, user, isPartner, access, modules,
   stationIds }`. The proxy does not cover `/api`. Use `getServiceClient()` only after this check.
3. **RLS** in Postgres. Helpers: `admin_full_access()` (partner, it_admin), `admin_has_module(m)`,
   `admin_can_see_location(provider, location_id)` (restrictive select on `cms_transactions`),
   `admin_access_levels()` (the role picklist). Partner-only policies have "Full-access admins" twins;
   module policies sit beside them.

`admin_users`: `access` (enum `admin_access`), `active`, `modules text[]`, `station_ids uuid[]` (empty =
all), `cms_operator_columns`. Signed-in users may update only their own `cms_operator_columns`; all
other changes go through `/api/admin/access` with the secret key. `accessChangeError` prevents removing
your own full access or the last full-access admin.

Adding a role: add it to the `admin_access` enum (own migration). Full access also needs it in
`FULL_ACCESS_ROLES` and in `admin_full_access()`.

## 7. Charging data (CMS)

```text
ChargeMOD API ──(chargemod.ts / operator.ts)──▶ provider.ts ──▶ /api/cms/operator ──▶ cms_transactions
                                                                       │                    ▲
                     browser: cmsWindowStore ◀── loadCmsWindow ◀───────┘   meter readings ──┘ /api/cms/live/[id]
```

- **Providers**: `providerIds.ts` lists platforms (`chargemod`, id prefix `chrgmod_`); `provider.ts`
  `CONNECTORS` maps each to a connector. Adding Ather: see `README.txt`.
- **Session ids** are stored with the platform prefix and stripped before calling the platform.
- **ChargeMOD login** is shared across instances via `cms_session` and the `cms_session_acquire /
  _store / _invalidate` functions (service_role only); one instance holds a login lease.
- **CMS and OCPI** rows are merged by `transactionId`; OCPI failures are tolerated.
  `currentUsedAmount` is thousandths of INR.
- **Delta sync**: each platform is asked only for sessions from its newest stored one (or the oldest still
  charging, under 2 days old), starting one minute early; older sessions come from the table.
- **Browser cache**: one window (6 Jul 2026 → now) in `sessionStorage`
  `triarc-cms-transaction-cache-v8`; Overview and the dashboard share it through `cmsWindowStore.ts`.
  Bump the key when the session shape changes; a new field also needs a table column and an entry in
  `SESSION_COLUMNS`.
- **Live readings**: `useLiveMetrics` polls every 30 s for charging sessions; `liveMetrics.ts` derives
  SoC, kW, battery size and time left; `meterPatch` writes energy/SoC back to the row.
- **Station filter**: `stationSelection.tsx` (choice in `localStorage` `triarc-admin-station`);
  `billing_invoice_stations` holds one record per station per platform (`provider`, `location_id`);
  records with the same name are one station (`groupStations`).

## 8. Billing

`EVBilling.jsx` reads and writes `billing_*` tables directly from the browser, so RLS is its only guard.
`invoiceMath.mjs`: `calc` (GST-inclusive rates), `words`, `gstinError`, `mergeLines`.
`sessionSuggestion.mjs`: AC/DC totals for a station and period → suggested lines. Invoice numbers:
`next_billing_invoice_number` RPC; saves: `save_billing_invoice` RPC (one transaction). The PDF layout
in `pdf()` mirrors an Excel template (rows A1:G37).

## 9. Database and migrations

- Schema changes: a new timestamped file in `supabase/migrations/`, applied to the project, then
  committed. New tables need RLS with admin policies like the existing ones, and a check in
  `supabase/tests/rls.test.sql`.
- The repo's migrations cannot rebuild the database from empty (the earliest tables predate them);
  the live project is the reference. The ESP32 device tables were created outside the repo.
- Live migration versions differ from the repo file names (applied with their own timestamp).

## 10. Tests

| Suite | Runs | Needs |
|---|---|---|
| `tests/admin-helpers.test.mjs` | Always | Nothing; pure helpers (invoice math, dates, filters, sync, metrics, access rules) |
| `tests/api.test.mjs` | When `API_BASE_URL` is set | A running site; signed-in part also `TEST_INVESTOR_*` / `TEST_PARTNER_*` `_EMAIL`/`_PASSWORD` |
| `tests/rls.test.mjs` | When `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` are set | Runs `supabase/tests/rls.test.sql` via the Management API; always rolls back; result is the raised message (`RLS OK: 67 checks passed`) |

Node loads `.ts` files directly, so a unit-tested file may only have type imports of other modules.
Add new API routes to `ROUTES` in `api.test.mjs`.

## 11. Release flow

Work on a branch off `main`. Nothing is committed straight to `main`.

1. **Push the branch.** Workers Builds builds it and runs `opennextjs-cloudflare upload`, which
   publishes a preview *version* of the `admin` Worker with its own URL. It takes no live traffic.
2. **Check the preview URL.** It is the real Worker with the real bindings and secrets, so it is the
   last place to catch what `npm run dev` and `npm run preview` hide.
3. **Promote by merging into `main`.** That build runs `opennextjs-cloudflare deploy`, which
   points live traffic at the new version — so the merge into `main` *is* the release.
4. Run `npm run lint`, `npm test` and `npm run opennext-build` before merging. The production build
   is not the place to discover a type error.

Workers Builds settings (dashboard → the `admin` Worker → **Settings** > **Build**):

| Setting | Value |
|---|---|
| Branch control → production branch | `main` |
| Branch control → Enable Preview Builds | on, so pushes to other branches build |
| Build command | `npm run opennext-build` |
| Deploy command (production branch only) | `npx opennextjs-cloudflare deploy` |
| Preview command (every other branch) | `npx opennextjs-cloudflare upload` |

A bare `opennextjs-cloudflare` is not on `PATH` in the build container, hence `npx` (or `npm run`):
that is what made the first deploy fail with `opennextjs-cloudflare: not found`.

The Preview command defaults to `npx wrangler preview`, which creates an isolated Worker Preview
with **its own** variables, secrets and bindings — nothing is inherited from production, so the
admin would come up with no Supabase keys until they are configured separately for Previews. We use
`opennextjs-cloudflare upload` (`wrangler versions upload`) instead: it publishes a *version* that
reuses the Worker's own settings and gets a Version URL. Version URLs are not generated for Workers
that implement Durable Objects; this one binds only `WORKER_SELF_REFERENCE`, `IMAGES` and `ASSETS`,
so they work. Keep it that way, or switch to Worker Previews deliberately.

A version can also be promoted without a merge, from the dashboard's Deployments tab or with
`npx wrangler versions deploy <version-id>`.

Before the first admin release: set the Supabase variables and `SUPABASE_SECRET_KEY` as Worker
variables/secrets, and add `<live address>/signin/set-password` to Supabase Auth redirect URLs.

## 12. Conventions

- Shared helpers in `lib/security.ts` for redirects, CSV and mailto/tel; never reimplement.
- Dialogs: `confirmDialog` / `promptDialog`, not `window.confirm`.
- Locations shown with `displayLocation()`; invoices print the stored name.
- Dark mode: `data-admin-theme`; overrides in `admin.module.css` / `billing.module.css` (add at the end).
- Files use CRLF line endings.
- Never store ChargeMOD `employeeDetails` (customer tokens).
