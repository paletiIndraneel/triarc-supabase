# Triarc Admin — Project Document

As of 29 Oct 2026 · Owner: Triarc Group

The Triarc admin is a single private web page (`/admin`) where Triarc's partners, IT admins and
investors watch the EV Hub's charging business, bill customers and manage who can see what. It
sits behind the public Triarc website and runs on the same Next.js app.

## 1. What the business needs from it

Triarc Group runs **TRIARC EV Hub**, an EV charging station in Bhadrachalam, Telangana. Chargers are
managed on **ChargeMOD** (a charging-platform / CMS). A second platform, **Ather**, is being installed
at the same site, and a second station is planned. The admin has to:

- Show live and historical charging: energy (kWh), revenue (₹), sessions, chargers in use.
- Bill business customers for charging, with Indian GST (CGST+SGST in Telangana, IGST elsewhere).
- Track website enquiries.
- Let partners decide which investors see which modules and which stations.

## 2. Modules

| Module | What it does | Who opens it |
|---|---|---|
| Overview | Today, current and previous half-month billing cycles, 30-day chart, live charging, finance summary | Everyone |
| CMS Dashboard | Charging sessions from ChargeMOD: AC/DC/CPO splits, cycle totals, live sessions with SoC and time-to-full, filterable table, CSV export, history backfill | Ticked |
| Billing | Customers, billing items (rates per kWh incl. GST), new bill with suggested lines from charging sessions, invoice PDFs, invoice status (issued → paid / cancelled) | Ticked |
| Enquiries | Messages from the website contact form, with status (New / Contacted / Closed) | Ticked |
| Stations | Stations and the charging-platform locations that feed them | Ticked |
| CPO Settings | Mobile numbers whose sessions count as Triarc's own use (CPO) | Ticked |
| Platform Bills | What a charging platform bills Triarc each cycle, beside the same cycle worked out from the stored sessions; confirm or dispute | Ticked to read, confirming needs full access |
| Platforms | Switch a charging platform on or off — how ChargeMOD gets frozen at the Ionage cutover | Partners and IT admins only |
| Access | Invite admins, set role, modules and stations | Partners and IT admins only |

## 3. Roles and access

| Role | Sees |
|---|---|
| Partner | Everything, all stations; manages Access |
| IT admin | Same as partner |
| Investor | Overview plus the modules ticked for them; optionally limited to chosen stations; never Access |

- New roles can be added in the database's picklist without code changes; they behave like investors
  unless marked full-access.
- A station limit hides other stations' charging sessions everywhere (dashboard, Overview, live status).
  Billing invoices are not station-limited.
- Ticking a module gives full use of it (for example, Stations allows editing stations).
- Access is enforced three times: at the page, in every server route, and in the database itself.

## 4. Key business rules

- **Billing cycles belong to the charging platform, not to Triarc.** ChargeMOD bills in half-months
  — 1st–15th and 16th–month end (IST) — which is where today's cycles come from; Ionage bills every
  7 days with payment 3 days after. One place defines this per platform, so a switch is one edit.
  Customer invoices stay on half-months. Financial figures use the Indian financial year (from 1 April).
- **A card belongs to one platform.** Two platforms on different cycles cannot be added into one
  total without producing a figure that matches no bill, so once more than one is live a platform
  has to be chosen. Today only ChargeMOD is live, so the choice is implied and hidden.
- **Rates include GST.** An invoice line is quantity × rate; GST is taken out of it, not added.
- **GST type** follows the customer's GSTIN state code: 36 (Telangana) → CGST + SGST, otherwise IGST.
- **Invoices are never deleted**, only cancelled, so invoice numbers are never reused.
- **CPO sessions** (Triarc's own use) are identified by ChargeMOD's transaction type, else by the CPO
  Settings mobile numbers. They are shown separately but still billed by the platform like the rest.
- A session "charging" for more than 7 hours, or an older duplicate on the same gun, is treated as stuck
  and not counted as live.

## 5. Where it runs

| Environment | Purpose |
|---|---|
| Cloudflare Workers (via OpenNext) | The live admin, deployed from the `TriarcGroup/ADMIN` repo. Branch pushes there become preview versions; merging into its `main` promotes one to live |
| Supabase project `kgfxlqgbzvtqfrqbblfo` ("Website", org TRIARC GROUP) | Sign-in, database, enquiry function |
| ChargeMOD | Source of charging sessions and live meter readings |

## 6. Status (29 Oct 2026)

Done and tested:
- Multi-platform sessions, multi-station stations, station selector, Access page with roles,
  modules and station limits, invite by email.
- Database access rules: automated test of 67 checks, all passing.
- Full browser pass of every module as partner and as a station-limited investor.

- Live on Cloudflare at `admin.triarcgroup.in`, deployed from `TriarcGroup/ADMIN` `main`.
- Dependencies brought to their latest supported versions on 28 Oct 2026 (Next 16.4.3,
  TypeScript 6, ESLint 10, Motion 14).
- CMS dashboard reworked on 29 Oct 2026: the three period cards became one matrix, with
  Consumption Details and Status beside it in a single row. Consumption now lists the five
  half-month cycles older than the matrix's two, with energy and revenue; every figure names its
  unit. Status is capped to the height of the two cards beside it, so opening a session scrolls
  inside the card rather than pushing the page down. The locations card and the table's "Active"
  count are gone, customer columns sit behind a click-to-reveal spoiler, and the charger column
  shows the gun number. Sign-in sits on a rain-on-glass background.
- Prepared for the Ionage move on 29 Oct 2026: the billing cycle now has one definition per
  charging platform, a Platforms page switches a platform on or off, and Platform Bills records
  what a platform bills Triarc against what the stored sessions say. All of it is inert while
  ChargeMOD is the only platform live — the admin looks exactly as it did.

Open:
- **Ionage migration.** The two database tables (`provider_settings`, `provider_bills`) were
  applied on 29 Oct 2026, so the Platforms and Platform Bills pages work. The cutover itself
  still needs: Ionage's API (in talks; the CPO
  portal APIs are the fallback), a connector, the date its 7-day cycles are counted from, and
  confirmation of whether the commission is on gross energy or net of Triarc's own CPO use, and
  how it rounds. Those last three are deliberately single values to correct once the first real
  bill arrives.
- The sign-in background is a generated placeholder; replace `public/signin-glass.png` with a real
  photograph (change `DEFAULT_SRC` in `RainGlassBackground.tsx` if the extension differs).
- Opening a live charging session on production has not been seen since the dashboard rework —
  there were no active sessions at release time, so the capped Status height is unverified there.
- Cloudflare build caching and preview builds are both off; turning them on is a dashboard switch
  (Settings → Build).
- Ather connector: waits for Ather's API.
- ESP32 / Raspberry Pi device integration: not built; device writes are limited to partners and IT
  admins until then.
- Enquiry spam limits written but the enquiry function is not yet deployed; the website team must add
  a hidden `website` field to the contact form for the bot trap.
- Leaked-password protection is off in Supabase Auth (a dashboard switch).
- Admin redesign in an Apple-like style is planned.
- Test data still present: "Mock Station 2 (test)" and `investor@test.com.invalid`.

## 7. Ownership

The admin area, its server routes and the Supabase database belong to this project.
