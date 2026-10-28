# Triarc Admin

Internal admin for **TRIARC EV Hub**, Triarc Group's EV charging business in Bhadrachalam,
Telangana. It is a private tool: nothing in it is meant to be public, and every route refuses
crawlers, search engines, AI agents and link-preview fetchers.

The public website is not in this repo. Both share one Supabase project, which is how the admin
reads the enquiries that site's contact form writes.

---

## Technology stack

| Component | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Backend | Supabase (Auth, Postgres with RLS, one Edge Function) |
| Hosting | Cloudflare Workers via OpenNext |

---

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build; also type-checks |
| `npm run lint` | ESLint; keep it at zero warnings |
| `npm test` | Unit tests for the admin helpers |
| `npm run opennext-build` | Build the Cloudflare Worker bundle |
| `npm run preview` | Run that Worker bundle locally |
| `npm run upload` | Upload a preview version to Cloudflare; takes no live traffic |
| `npm run deploy` | Deploy from a workstation; normally unnecessary, see below |

---

## Releasing

Production is deployed from **`TriarcGroup/ADMIN`**, not from this repository: Cloudflare Workers
Builds builds the `admin` Worker from that repo's `main`. This copy is for development and is not
watched by Cloudflare, so a push here deploys nothing to production. Both repos use the same
Supabase project, so anything run from here reads and writes production data.

In the company repo, work on a branch off `main`, not on `main` itself.

1. **Push the branch.** Cloudflare Workers Builds builds it and uploads a *preview version* with its
   own URL, which takes no live traffic.
2. **Check that preview.** It is the real Worker with the real bindings, so it catches what
   `npm run dev` hides.
3. **Promote by merging into `main`.** That build deploys to the live Worker, so the merge
   is the release. Run `npm run lint`, `npm test` and `npm run opennext-build` first.

---

## Project structure

```text
src/
├── app/          # the admin page (/), /signin, /unauthorized, and src/app/api/
├── components/   # UI; components/admin/AdminApp.tsx is the module shell
├── lib/          # Supabase clients, the ChargeMOD/CMS integration, billing and access helpers
└── proxy.ts      # session + admin check and crawler blocking, on every route

supabase/         # migrations, the RLS audit, and the submit-enquiry Edge Function
docs/             # PROJECT.md (what it does) and DEVELOPER.md (how to work on it)
tests/            # unit, API and RLS suites
```

The admin is a single page: modules are switched inside `AdminApp.tsx` and mirrored in
`/?module=…` rather than routed. Start with `docs/DEVELOPER.md`.
