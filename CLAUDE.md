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

**Admin UI** is a single client shell: `/admin` (`src/app/admin/page.tsx`) loads enquiries server-side and renders `src/components/admin/AdminApp.tsx`, which switches modules (cms, billing, enquiries, cpo-settings) via `AdminModuleContext` state, not routing; the active module is mirrored in `/admin?module=…` (pushState + popstate) so refresh and Back keep it. **`/admin` is the only admin route**: module components under `src/app/admin/*/` must not be named `page.tsx`, and `next.config.ts` redirects any `/admin/*` URL to `/admin`. Nav items are in `src/components/admin/adminNavigation.ts`.

**Supabase clients**: `src/lib/supabase/server.ts` (cookie-based, for server components/route handlers) and `client.ts` (browser). `billing.ts` exports a browser singleton used by the billing module.

**CMS operator dashboard**: `src/lib/cms/operator.ts` talks to an external charger-management API (chargemod). It reads config from the Cloudflare runtime env (`getCloudflareContext`) with a `process.env` fallback, and shares one ChargeMOD token across all server instances through the `cms_session` table (`cms_session_acquire`/`_store`/`_invalidate` RPCs, called with the admin's session; only the lease holder logs in), with a per-instance memory cache in front. Exposed through `src/app/api/cms/*`; returns 404 when `CMS_OPERATOR_DASHBOARD_ENABLED` is off.

**Shared helpers** in `src/lib/security.ts`: `getSafeCallbackUrl` (open-redirect guard for sign-in callbacks), `neutralizeCsvCell` (CSV export injection), `safeMailtoHref`, `safeTelHref`. Use them rather than reimplementing.

**Database**: schema changes go in `supabase/migrations/` as timestamped SQL; new tables need RLS enabled with admin policies matching the existing pattern.

## Gotchas

- **Billing** (`src/app/admin/billing/EVBilling.jsx`) reads/writes `billing_*` tables directly from the browser via the singleton in `src/lib/supabase/billing.ts`, so RLS is its only guard. Invoice numbers come from the `next_billing_invoice_number` RPC; the PDF layout in `pdf()` mirrors an Excel template (rows A1:G37). GST is CGST+SGST when the customer GSTIN state code is `36` (Telangana), else IGST.
- **CMS data flow**: the dashboard (`src/app/admin/cms/CmsDashboard.tsx`) makes one `/api/cms/operator` call covering previous month + month-to-date, caches rows in `sessionStorage` (`triarc-cms-transaction-cache-v4`) and derives all metrics client-side. Bump the cache key if the `sanitizeTransaction` shape changes.
- `operator.ts` merges CMS and OCPI rows by `transactionId`; OCPI failures are tolerated, CMS failures are not. `currentUsedAmount` is in thousandths of INR (divided by 1000). ChargeMOD hosts `ogs.console.chargemod.com` / `ls.console.chargemod.com` are hardcoded; locations are discovered from the login payload.
- CPO energy on the dashboard is classified by ChargeMOD's `transaction.type` (`"CPO"`) when it is set; only transactions with no type fall back to the `cpo_mobile_numbers` list from the CPO Settings module.
