# CMS Operator Dashboard — Cloudflare setup

The CMS Operator Dashboard is intentionally controlled by Cloudflare runtime configuration. No ChargeMOD username, password, bearer token, or CMS URL is committed to GitHub.

## Cloudflare Worker runtime variables

In the Cloudflare Worker for `triarc-supabase-test`, add:

- `CMS_OPERATOR_DASHBOARD_ENABLED=true`
- `CMS_API_URL=https://ls.console.chargemod.com`

Add these as **Secrets**:

- `CMS_API_USERNAME`
- `CMS_API_PASSWORD`
- `CMS_API_ORGANIZATION_ID`
- `CMS_API_PROJECT_ID`
- `CMS_API_LOCATION_ID`

The organization, project, and location identifiers are intentionally runtime configuration too. They are kept out of the repository and should be configured as **Secrets** because they are internal operator identifiers.

## Cloudflare Dashboard

Worker → Settings → Variables and Secrets:

1. Add `CMS_OPERATOR_DASHBOARD_ENABLED` as an Environment Variable with value `true`.
2. Add `CMS_API_URL` as an Environment Variable with value `https://ls.console.chargemod.com`.
3. Add `CMS_API_USERNAME` as a Secret.
4. Add `CMS_API_PASSWORD` as a Secret.
5. Add `CMS_API_ORGANIZATION_ID` as a Secret.
6. Add `CMS_API_PROJECT_ID` as a Secret.
7. Add `CMS_API_LOCATION_ID` as a Secret.
8. Redeploy the Worker.

If `CMS_OPERATOR_DASHBOARD_ENABLED` is missing or anything other than `true`, the CMS dashboard is hidden from the TriArc admin and the CMS API routes return 404.

## Wrangler alternative

From a machine authenticated to the correct Cloudflare account:

```bash
npx wrangler secret put CMS_API_USERNAME
npx wrangler secret put CMS_API_PASSWORD
npx wrangler secret put CMS_API_ORGANIZATION_ID
npx wrangler secret put CMS_API_PROJECT_ID
npx wrangler secret put CMS_API_LOCATION_ID
```

The two non-secret runtime variables are the feature flag and CMS API base URL. All CMS account and internal operator identifiers remain runtime secrets. Do not put the CMS password or bearer token in `wrangler.jsonc`, GitHub Actions, `.env` committed to the repository, browser code, Supabase, or a `NEXT_PUBLIC_*` variable.

## Local development

For local testing, use an untracked local environment file only. Never commit it.

The application also accepts these values through `process.env` when running outside the Cloudflare Worker runtime.

## Security model

Every CMS route still verifies the existing Supabase authenticated active-admin record.

The browser calls only TriArc routes:

- `/api/cms/dashboard`
- `/api/cms/transactions`
- `/api/cms/active-transactions`

The TriArc server logs into ChargeMOD, keeps the bearer token server-side, retries once after a CMS 401, and sanitizes transaction records before returning them to the browser.

Sensitive nested CMS fields are deliberately not forwarded.
