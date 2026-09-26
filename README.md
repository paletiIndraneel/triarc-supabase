# TriArc Website

TriArc website application with Supabase authentication and enquiry management.

The application provides:

- Public company website
- Administrator authentication
- Protected Admin area
- Website enquiry submission
- Supabase PostgreSQL storage
- Supabase Edge Functions
- Cloudflare deployment

---

## Technology Stack

| Component | Technology |
|---|---|
| Framework | Next.js |
| UI | React |
| Language | TypeScript |
| Authentication | Supabase Auth |
| Database | Supabase PostgreSQL |
| Backend Function | Supabase Edge Functions |
| Hosting | Cloudflare Workers |
| Next.js Adapter | OpenNext |

---

## Project Structure

```text
src/
├── app/
│   ├── admin/
│   ├── signin/
│   └── ...
│
├── components/
│   ├── Admin/
│   ├── Visit/
│   └── ...
│
├── lib/
│   └── supabase/
│       ├── client.ts
│       └── server.ts
│
└── middleware.ts

supabase/
├── config.toml
└── functions/
    └── submit-enquiry/
        ├── deno.json
        └── index.ts
