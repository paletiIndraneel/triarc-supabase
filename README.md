# Triarc Group

Triarc Group's website. Triarc runs **TRIARC EV Hub**, an EV charging station in Bhadrachalam, Telangana. The hub charges cars and installs chargers for drivers, businesses and fleets.

---

## Technology stack

| Component | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Backend | Supabase |
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
| `npm test` | Unit tests |
| `npm run preview` | Run the Cloudflare build locally |

---

## Project structure

```text
src/
├── app/          # pages (charging-solutions, ev-station, locations, explore-bhadrachalam, about, contact)
├── components/   # UI components
├── data/         # page content
└── lib/          # shared helpers

supabase/         # database migrations and the enquiry function
public/           # images and logos
```

Edit page text in `src/data/`. The components only handle layout.
