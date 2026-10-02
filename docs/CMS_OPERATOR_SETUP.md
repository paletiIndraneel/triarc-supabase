# CMS Operator Dashboard — Cloudflare setup

The CMS Operator Dashboard is intentionally controlled by Cloudflare runtime configuration. No ChargeMOD username, password, bearer token, organization ID, project ID, or location ID is committed to GitHub.

## Cloudflare Worker runtime variables

Configure these values on the Cloudflare Worker:

### Environment variables

- `CMS_OPERATOR_DASHBOARD_ENABLED=true`
- `CMS_API_URL=https://ls.console.chargemod.com`

### Secrets

- `CMS_API_USERNAME`
- `CMS_API_PASSWORD`
- `CMS_API_LOCATION_ID`

**Do not configure `CMS_API_ORGANIZATION_ID` or `CMS_API_PROJECT_ID`.** The application discovers these dynamically after authenticating with ChargeMOD:

1. It calls the ChargeMOD organization endpoint.
2. It considers active, non-suspended organizations.
3. It queries each candidate organization's projects.
4. It selects the project whose name is `PowerLine`.

This keeps organization/project IDs out of both source code and runtime configuration.

## Cloudflare Dashboard

Worker → Settings → Variables and Secrets:

1. Add `CMS_OPERATOR_DASHBOARD_ENABLED` as an Environment Variable with value `true`.
2. Add `CMS_API_URL` as an Environment Variable with value `https://ls.console.chargemod.com`.
3. Add `CMS_API_USERNAME` as a Secret.
4. Add `CMS_API_PASSWORD` as a Secret.
5. Add `CMS_API_LOCATION_ID` as a Secret.
6. Redeploy the Worker.

If `CMS_OPERATOR_DASHBOARD_ENABLED` is missing or anything other than `true`, the CMS dashboard option is hidden from the TriArc admin and the CMS API routes return 404.

The location ID remains configuration because ChargeMOD's location endpoint currently requires an allowed-location value. Keep it as a Secret.

## Wrangler alternative

From a machine authenticated to the correct Cloudflare account:

```bash
npx wrangler secret put CMS_API_USERNAME
npx wrangler secret put CMS_API_PASSWORD
npx wrangler secret put CMS_API_LOCATION_ID
```

The two non-secret runtime variables are the feature flag and CMS API base URL.

Do not put the CMS password, bearer token, organization ID, project ID, or location ID in `wrangler.jsonc`, GitHub Actions, committed `.env` files, browser code, Supabase, or a `NEXT_PUBLIC_*` variable.

## Local development

For local testing, use an untracked local environment file only. Never commit it.

The application accepts the same CMS settings through `process.env` when running outside the Cloudflare Worker runtime:

- `CMS_OPERATOR_DASHBOARD_ENABLED`
- `CMS_API_URL`
- `CMS_API_USERNAME`
- `CMS_API_PASSWORD`
- `CMS_API_LOCATION_ID`

## Runtime behavior

The CMS module authenticates against the ChargeMOD login service and obtains a temporary bearer token. The token is kept server-side and cached in the Worker runtime with a 45-minute lifetime and a two-minute refresh buffer.

Concurrent requests share an in-flight token refresh instead of issuing multiple login requests. A CMS 401 invalidates only the token used by that request and triggers one retry with a fresh token.

The organization/project context is also cached and concurrent discovery requests are coalesced.

## Security model

Every CMS route verifies the existing Supabase authenticated active-admin record.

The browser calls only TriArc routes:

- `/api/cms/dashboard`
- `/api/cms/transactions`
- `/api/cms/active-transactions`

The TriArc server:

1. Authenticates to ChargeMOD using the runtime username/password.
2. Dynamically discovers the active PowerLine organization/project.
3. Uses the configured location ID.
4. Keeps the bearer token server-side.
5. Retries once after a CMS 401.
6. Sanitizes transaction records before returning them to the browser.

Sensitive nested CMS fields are deliberately not forwarded.

The CMS feature flag controls visibility and route availability; it is not an authorization mechanism. Admin authentication and the active `public.admin_users` record remain required regardless of the flag.
