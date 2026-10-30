# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

This repo (branch `main`) is **only the Triarc admin**, meant for its own subdomain: the public website was removed from it and is maintained separately by the website team; its last state here is in this repo's history. The admin is the app's root page `/` (modules are `/?module=…`; old `/admin` and `/admin/*` URLs redirect to `/`), plus `/signin`, `/signin/set-password`, `/unauthorized` and `src/app/api/`. Module components still live in `src/app/admin/*/` (a component folder, not a route). The Supabase project is shared with the website: its contact form writes `enquiries` through `supabase/functions/submit-enquiry`.

**Private site**: nothing may be indexed. `src/proxy.ts` returns 403 to crawlers, search engines, AI agents and link-preview fetchers on every route (`src/lib/bots.ts`, `isBot`; only `robots.txt` stays readable), `robots.ts` disallows everything, every response carries `X-Robots-Tag` no-index/no-AI (`next.config.ts`), and the root layout sets robots meta. Keep all four when adding routes. The sign-in, set-password, unauthorized and 404 pages use `AuthShell` (`src/components/admin/AuthShell.tsx`) so they match the admin's palette.

## Commands

```bash
npm run dev             # Next.js dev server
npm run build           # next build --webpack (webpack, not Turbopack)
npm run lint            # eslint . (flat config in eslint.config.mjs; React Compiler rules are errors, keep it at 0 warnings)
npm run opennext-build  # build the Cloudflare Worker bundle into .open-next/
npm run preview         # run the Worker bundle locally (wrangler)
npm run upload          # upload a preview version (wrangler versions upload); takes no live traffic
npm run deploy          # deploy to Cloudflare (worker "admin" in the triarcgroup9 account, see wrangler.jsonc); only when explicitly asked. SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY must be set in the shell when building, since they are inlined at build time
```

**Hosting:** the admin is served from **Cloudflare Workers** via OpenNext (worker `admin` in the `triarcgroup9` account, see `wrangler.jsonc`); Vercel is no longer used. Runtime settings come from the Worker's variables and secrets, read through `getRuntimeEnv` in `src/lib/cms/operator.ts` (`getCloudflareContext`, falling back to `process.env` for `next dev` and the test runners). The Supabase URL and publishable key are inlined at build time, so they must be set in the shell that builds. `@opennextjs/cloudflare` tracks `^1.20.13`, which needs Next >= 16.4.1 (this project is on 16.4.3); if Next is ever pinned below 16.4.1, OpenNext has to drop to `1.20.11` or `npm install` fails on peers. **Two repos.** Production is **`TriarcGroup/ADMIN`** — code only, no agent files — and Cloudflare Workers Builds deploys the `admin` Worker from its `main`. This repo (`paletiIndraneel/triarc-supabase`) is the development copy: full history plus the agent tooling, **not watched by Cloudflare**, so a push here deploys nothing. A change reaches production by landing in the company repo, and the flow below describes that repo. Both point at the **same Supabase project**, so anything run from this copy reads and writes production data. **Releases go through a branch, never a commit straight to `main`.** Push work to a branch: Workers Builds builds it and runs `opennextjs-cloudflare upload`, publishing a preview version that takes no live traffic. Merging that branch into `main` is the promotion — that build runs `opennextjs-cloudflare deploy` and goes live, so **the merge is the release**. Run `npm run lint`, `npm test` and `npm run opennext-build` before merging, and only push, merge or deploy when asked.

`npm test` runs unit tests for the pure admin helpers (`tests/admin-helpers.test.mjs`, Node's built-in runner: invoice math, IST date ranges, transaction filters, sync/meter helpers, overview/finance metrics, access rules). Node loads the `.ts` files directly, so a tested file may only have *type* imports of other modules (no `@/` runtime imports). Verify everything else with `npm run build` (it type-checks). Two more suites in `tests/` skip unless their env is set:
- `api.test.mjs`: HTTP checks that every admin API route refuses signed-out and forged-cookie requests, plus read-only signed-in checks. Needs `API_BASE_URL` (e.g. a `next dev` started with placeholder Supabase env), and for the signed-in part `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` and `TEST_INVESTOR_*`/`TEST_PARTNER_*` `_EMAIL`/`_PASSWORD`. Add new API routes to its `ROUTES` list.
- `rls.test.mjs` runs `supabase/tests/rls.test.sql` through the Management API (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`). The SQL acts as each kind of admin inside one `DO` block that always ends by raising, so it rolls back and is safe on the live project; the result is the message (`RLS OK` / `RLS FAILED`, plus known gaps). The repo's migrations cannot rebuild the database (the original tables predate them), so there is no local test database. Add a check there with every new table or policy.

Env vars: copy `.env.example`. `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_…` key) are required. They have no `NEXT_PUBLIC_` prefix: `next.config.ts` `env` inlines them at build time (so they are still public in the browser bundle and a change needs a rebuild), falling back to the old `NEXT_PUBLIC_SUPABASE_*` names. `SUPABASE_SECRET_KEY` (`sb_secret_…`, bypasses RLS) is server-only, read at request time, and must never go into `next.config.ts` `env`; the ChargeMOD login, session writes and the Access page need it. The `CMS_*` vars enable the optional CMS operator dashboard. Secrets are Cloudflare Worker variables/secrets (`keep_vars: true` in `wrangler.jsonc` keeps the dashboard values across deploys).

## Architecture

Next.js 16 App Router site (React 19, Tailwind 4, TypeScript) served to users from Cloudflare Workers via OpenNext. Supabase provides auth, Postgres and one Edge Function.

`next.config.ts` sets the security headers/CSP and the no-index header.

**Enquiries**: the public website's contact form (not in this branch) calls the Supabase Edge Function `supabase/functions/submit-enquiry` (Deno, `auth: "none"`), which validates and size-limits input before inserting into `enquiries`. Its limits must match the form's `maxLength` values on the website side.

**Admin auth is enforced in three layers. Keep all three when adding admin features:**
1. `src/proxy.ts` (Next 16's renamed middleware) guards the admin page `/`: requires a Supabase session *and* an active row in `admin_users` with `role = 'admin'`; otherwise redirects to `/signin` or `/unauthorized`.
2. Each `src/app/api/**/route.ts` re-checks admin by calling `getAdminClient()` from `src/lib/supabase/server.ts` (the proxy matcher does not cover `/api`).
3. RLS policies in Postgres check the same `admin_users` condition (see `supabase/migrations/`, `supabase/rls-audit.sql`).

**Access levels**: `admin_users.access` is `partner` or `it_admin` (both full access: the whole admin) or `investor` (CMS dashboard + enquiries only; new admins default to investor), and a role without full access can be limited to some stations in `admin_users.station_ids` (empty = all stations). The roles are the `admin_access` picklist values, read at run time through `admin_access_levels()` (a new value needs no code change); which roles have full access is `FULL_ACCESS_ROLES` in `src/lib/adminAccess.ts` and the same set in Postgres `admin_full_access()`. It is enforced in all three layers: `canOpenModule` in `adminNavigation.ts` hides/blocks modules (full access opens all; others their ticked `GRANTABLE_MODULES`), `getAdminClient()` returns `isPartner` (= full access), `access` and `stationIds` for API checks (session APIs filter a station-limited investor's results; session writes use the secret-key client), and RLS: the partner-only policies have "Full-access admins" twins, and a restrictive `cms_transactions` select policy (`admin_can_see_location`) limits station-limited investors. Admins are managed on the Access page (`src/app/admin/access/Access.tsx`, `/api/admin/access`, secret key): invite by email (link lands on `/signin/set-password`), change level, active state, modules (`admin_users.modules` check boxes; `canOpenModule`, `admin_has_module()` policies, Overview always open, Access full-access only) and stations (a dropdown multi-select; a picked record stands for every record of that station name); `accessChangeError` stops anyone removing their own full access or the last full-access admin.

**Admin UI** is a single client shell: `/` (`src/app/page.tsx`) loads enquiries server-side and renders `src/components/admin/AdminApp.tsx`, which switches modules (overview, the default landing page; cms, billing, enquiries, stations, access, cpo-settings, platforms, provider-bills) via `AdminModuleContext` state, not routing; the active module is mirrored in `/?module=…` (pushState + popstate) so refresh and Back keep it. **`/` is the only admin route**: module components under `src/app/admin/*/` must not be named `page.tsx`, and `next.config.ts` redirects `/admin` and any `/admin/*` URL to `/`. Top-bar items are in `src/components/admin/adminNavigation.ts` (drawn with `SlidingTabs`); Stations, Access, CPO Settings, Platform Bills and Platforms sit in the account menu (`AccountMenu.tsx`, with the Light/Dark/System theme); `FULL_ACCESS_ONLY` in `adminNavigation.ts` (access, platforms) can never be granted to anyone else, even by writing the name into `admin_users.modules`. Shared animated pieces adapted from Kokonut UI (MIT, `motion` package) live in `src/components/ui/`, each keeping its attribution header and using the palette tokens only: `SlidingTabs` (header modules, Billing tabs, Overview metric switch), `StackPanel` (the CMS Status card; a session page comes from `sessionPage()` in `cms/SessionDetails.tsx`; its title is left-aligned on the root page and centred on a pushed one, and a page's `trailing` fills the right of the header; the dashboard wraps it in a scrolling box capped to the height of the matrix/Consumption pair, so an open session never grows the row), `Loader` (the CMS table while sessions load), `Spoiler` (mobile numbers and GSTINs on screen — click to reveal; the CMS table's vehicle number and customer name are deliberately in plain sight, since a row is recognised by them) and `RainGlassBackground` (the sign-in page, via `AuthShell`'s `background` prop, which also frosts the card; needs WebGL2 and `public/signin-glass.png`, a generated placeholder named by `DEFAULT_SRC`, and degrades to the plain background without either).

**Supabase clients**: `src/lib/supabase/server.ts` (cookie-based, for server components/route handlers) and `client.ts` (browser). `billing.ts` exports a browser singleton (used by billing and most other admin modules). `service.ts` `getServiceClient()` is the secret-key client (null when `SUPABASE_SECRET_KEY` is unset); only use it in route handlers *after* `getAdminClient()` has checked the user.

**CMS operator dashboard**: `src/lib/cms/operator.ts` talks to an external charger-management API (chargemod). It reads config from the Cloudflare runtime env (`getRuntimeEnv`: `getCloudflareContext` with a `process.env` fallback), and shares one ChargeMOD token across all server instances through the `cms_session` table (`cms_session_acquire`/`_store`/`_invalidate` RPCs, executable only by `service_role` since migration `20261022000300`, so `chargemod.ts` calls them with the secret-key client; only the lease holder logs in), with a per-instance memory cache in front. Routes reach charging platforms only through `src/lib/cms/provider.ts` (`getChargingProviders`: one entry per switched-on platform, each with `fetchSessions` and optional `fetchMeterReadings`); platforms are listed in `providerIds.ts` (id, label, session-id prefix such as `chrgmod_`) and each has a connector file (`chargemod.ts`). Adding or removing a platform is described in `README.txt`; meter saves go through `saveMeterReadings` in `transactionStore.ts`. Exposed through `src/app/api/cms/*`; returns 404 when `CMS_OPERATOR_DASHBOARD_ENABLED` is off.

**Shared helpers** in `src/lib/security.ts`: `getSafeCallbackUrl` (open-redirect guard for sign-in callbacks), `neutralizeCsvCell` (CSV export injection), `safeMailtoHref`, `safeTelHref`. Use them rather than reimplementing.

**Database**: schema changes go in `supabase/migrations/` as timestamped SQL; new tables need RLS enabled with admin policies matching the existing pattern.

## Gotchas

- **Billing** (`src/app/admin/billing/EVBilling.jsx`) reads/writes `billing_*` tables directly from the browser via the singleton in `src/lib/supabase/billing.ts`, so RLS is its only guard. Invoice numbers come from the `next_billing_invoice_number` RPC; the PDF layout in `pdf()` mirrors an Excel template (rows A1:G37). GST is CGST+SGST when the customer GSTIN state code is `36` (Telangana), else IGST. Stations are `billing_invoice_stations` records, one per station per charging platform (`provider`, `location_id`, `location_name` columns, unique together); records with the same name are one station (`groupStations` in `transactionFilters.ts`), and the Stations module (`src/app/admin/stations/Stations.tsx`) edits a station's records together, links locations (unlinked ones come from the `session_locations` view) and never deletes (unlinking empties a record). The New Bill suggestion counts the chosen station's record on the customer's platform. (The old `station_locations` table and `platform_locations` column were dropped on 2026-10-22.)
- **CMS data flow**: the dashboard (`src/app/admin/cms/CmsDashboard.tsx`) makes one `/api/cms/operator` call covering 6 Jul 2026 (IST) to now, caches rows in `sessionStorage` (`triarc-cms-transaction-cache-v8`; logout clears it) and derives all metrics client-side; the table's date filter never refetches. Bump the cache key if the `sanitizeTransaction` shape changes; a new field also needs a column in the sessions table and in `SESSION_COLUMNS`. The Overview and CMS dashboard share that load through `cmsWindowStore.ts` (one request and one Refresh spinner for both) and share the station selector (`stationSelection.tsx`, choice kept in `localStorage` `triarc-admin-station`, hidden with fewer than two stations).
- **CMS delta sync**: `/api/cms/operator` syncs each platform separately and asks it only for sessions from its newest row in the sessions table (`SESSIONS_TABLE` in `transactionStore.ts`: `cms_transactions`, with a `provider` column and platform-prefixed ids such as `chrgmod_…`; see `README.txt`) onward, or from the oldest stored session still charging (`stopped_at` null, under 2 days old; older open rows are ChargeMOD ghosts and ignored) so it gets its final values, starting one minute early because ChargeMOD omits a session starting exactly at `startDate`; older sessions of the window are read from that table, and an empty table means a full fetch. Active sessions are stored too. Every active admin's load (partner or investor) saves the sessions it fetched, and the dashboard polls meter readings for every charging session (`useLiveMetrics`), which also writes their Energy/SoC into the session's own columns (`meterPatch`: while charging, or only empty columns once finished; `keepMeterValues` stops a sync from wiping them); the history backfill button (`/api/cms/live/backfill`: stage `transactions`, then `meters`, over the previous billing cycle: 1st–15th when pressed on the 16th–month end, else 16th–end of last month) also writes (RLS: insert/update for active admins, delete partner-only). Session types (raw ChargeMOD, sanitized, table row) are in `src/lib/cms/types.ts`; helpers in `src/lib/cms/transactionStore.ts`. `employeeDetails` is never stored (customer ChargeMOD tokens). `loadCmsWindow` first shows a stored copy (the tab's stale cache, else the sessions table read straight from the browser) and then swaps in the live response.
- `operator.ts` merges CMS and OCPI rows by `transactionId`; OCPI failures are tolerated, CMS failures are not. `currentUsedAmount` is in thousandths of INR (divided by 1000). ChargeMOD hosts `ogs.console.chargemod.com` / `ls.console.chargemod.com` are hardcoded; locations are discovered from the login payload.
- CPO energy on the dashboard is classified by ChargeMOD's `transaction.type` (`"CPO"`) when it is set; only transactions with no type fall back to the CPO Settings numbers, matched through the `cpo_mobile_matches` RPC (`cpoNumbersCache.ts`).
- **Billing cycles** have one definition: `src/lib/billingCycle.ts` (pure, no imports, so `tests/` can load it). `PROVIDER_CYCLES` keys a `CycleRule` by platform — `half-month` (ChargeMOD: 1st–15th and 16th–month end IST) or `days` with a length and anchor date (Ionage: 7 days, payment T+3). `cycleContaining`/`previousCycle`/`cyclesBack`/`comparisonCycle`/`cycleLabel`/`maxCycleDays`/`previousBillingCycle` all take the rule, and the Overview cards, the CMS matrix, its Consumption Details and the backfill window all come from it — so changing a platform's billing is one edit there, not four. `overviewMetrics.ts` takes the cycles it should sum instead of deriving them: it is loaded directly by the test runner, so it must keep to type-only imports, which is also why `previousBillingCycle` moved out of `transactionStore.ts` (what stays there is a 16-day bound on a backfill window, not a cycle). Customer invoice periods still use half-months (`EVBilling.jsx` untouched); finance figures (`financeMetrics.ts`) use the Indian financial year (from 1 April).
- **One platform per card** (`cms/platformSelection.tsx`, shared by the dashboard and Overview, `localStorage` `triarc-admin-platform`): figures from two platforms are never summed, since their cycles close on different days and the total would match no bill. The CMS dashboard passes `{ allowAll: true }` and so offers "All platforms", which means *side by side*: every matrix row is drawn once per platform (the column heading then lists each one's cycle dates), Consumption Details gives each platform a heading and three cycles instead of five, and the Status card and the sessions table name the platform on each row. Overview sums into one figure per card, so it never offers it and reads a remembered "all" as the first platform. The hook returns `selection` (what the dropdown shows), `shown` (the platforms the cards cover) and `providerId` (the single one, null in "all"); the sessions table has no platform filter of its own, it follows `shown`. Options come from the unfiltered cache so choosing one never narrows the list; hidden with fewer than two.
- **Platforms** (`admin/platforms/Platforms.tsx`, `/api/admin/platforms`, `provider_settings`): full-access only. A platform is live only when enabled there *and* its credentials exist — `getChargingProviders` needs both, and an unreadable table leaves every platform as its env vars say rather than emptying the dashboard. Credentials never enter the table or the browser; only the names of missing env vars do, and enabling without them is refused. Switching off stops fetching only; stored sessions stay (that is how ChargeMOD gets frozen at the cutover). **Platform Bills** (`admin/provider-bills/`, `/api/admin/provider-bills`, `provider_bills`) records what a platform bills Triarc per cycle (`their_*`, keyed in by hand) against `our_*` figures the route recomputes from `cms_transactions` on every save rather than trusting the request, with CPO sessions excluded from billable energy; reading needs the module, confirming needs full access. `PROVIDER_COMMISSION_PER_KWH` holds Ionage's ₹1/kWh. Both migrations were applied to the live project on 29 Oct 2026 (RLS suite: `RLS OK`, 81 checks).
- **Admin UI conventions**: use `confirmDialog`/`promptDialog` (`src/components/admin/confirmDialog.tsx`) instead of `window.confirm`/`prompt`; show locations with `displayLocation()` ("Triarc EV hub | Bhadrachalam" → "Bhadrachalam"), but invoices print the stored name. **Colours** come only from the palette tokens in `globals.css` (`:root` light, `[data-theme="dark"]` dark), exposed to Tailwind as `bg-page`/`bg-surface`/`bg-raised`/`bg-soft`, `text-ink`/`text-muted`/`text-accent`, `border-line`, `bg-primary` + `text-primary-ink` (buttons), `bg-accent-pale`, `ring-focus-ring`; plain CSS uses the `var(--…)` names. Don't add slate/violet/hex colours: use a token, and both themes follow. Status colours (red/amber/emerald) stay Tailwind, with dark tints at the end of `admin.module.css`. The theme toggle (`AdminApp.tsx`, `localStorage` `triarc-admin-theme`) sets `data-admin-theme` on the shell and `data-theme` on `<html>` (so dialogs mounted on `<body>` follow).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

## Working guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
