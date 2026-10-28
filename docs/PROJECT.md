# Triarc Admin — Project Document

As of 23 Oct 2026 · Owner: Triarc Group

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

- **Billing cycles** are half-months: 1st–15th and 16th–month end (IST). Financial figures use the
  Indian financial year (from 1 April).
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
| Cloudflare Workers (via OpenNext) | The live admin. Cloudflare Workers Builds deploys it from `development`: every push to that branch goes live |
| Supabase project `kgfxlqgbzvtqfrqbblfo` ("Website", org TRIARC GROUP) | Sign-in, database, enquiry function |
| ChargeMOD | Source of charging sessions and live meter readings |

## 6. Status (23 Oct 2026)

Done and tested:
- Multi-platform sessions, multi-station stations, station selector, Access page with roles,
  modules and station limits, invite by email.
- Database access rules: automated test of 67 checks, all passing.
- Full browser pass of every module as partner and as a station-limited investor.

Open:
- Cloudflare release: needs the Supabase settings (incl. the secret key) as Worker
  variables/secrets and the `/signin/set-password` redirect URL for the live address.
- Dependencies were brought to their latest supported versions on 28 Oct 2026 (Next 16.4.3,
  TypeScript 6, ESLint 10, Motion 14). Build, type-check, lint and unit tests pass; the admin has
  not been opened in a browser since, so the Motion 14 animations are unverified.
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
