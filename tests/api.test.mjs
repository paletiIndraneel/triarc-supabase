// HTTP tests for the admin API's access checks, against a running site (`npm run dev`, a
// Vercel preview or `npm run preview`). Skipped unless API_BASE_URL is set, e.g.
//   API_BASE_URL=http://localhost:3000 npm test
// Signed-in checks also need SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY and a test login:
// TEST_INVESTOR_EMAIL/_PASSWORD (any role without full access) and TEST_PARTNER_EMAIL/_PASSWORD
// (partner or IT admin). They only read; nothing here writes data or calls ChargeMOD.
import test from "node:test";
import assert from "node:assert/strict";

const base = process.env.API_BASE_URL?.replace(/\/$/, "");
const skip = !base && "set API_BASE_URL";

const call = (path, { method = "GET", body, cookie } = {}) =>
  fetch(`${base}${path}`, {
    method,
    redirect: "manual",
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

// Every admin API route checks the user before doing anything (getAdminClient).
const ROUTES = [
  ["GET", "/api/admin/access"],
  ["POST", "/api/admin/access", { email: "x@test.invalid", access: "investor" }],
  ["PATCH", "/api/admin/access", { userId: "00000000-0000-0000-0000-000000000000", access: "partner" }],
  ["GET", "/api/admin/cpo-numbers"],
  ["POST", "/api/admin/cpo-numbers", { mobileNumber: "9876543210" }],
  ["PUT", "/api/admin/cpo-numbers", { id: "x", mobileNumber: "9876543210" }],
  ["DELETE", "/api/admin/cpo-numbers", { id: "x" }],
  ["GET", "/api/admin/preferences"],
  ["PUT", "/api/admin/preferences", { columns: ["id"] }],
  ["GET", "/api/cms/operator"],
  ["GET", "/api/cms/live/chrgmod_1"],
  ["POST", "/api/cms/live/backfill", { stage: "transactions" }],
];

test("admin API refuses requests without a signed-in admin", { skip }, async () => {
  for (const [method, path, body] of ROUTES) {
    const response = await call(path, { method, body });
    assert.equal(response.status, 403, `${method} ${path}`);
  }
});

test("admin API refuses a forged session cookie", { skip }, async () => {
  const cookie = "sb-x-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJmb3JnZWQifQ";
  for (const [method, path, body] of ROUTES) {
    assert.equal((await call(path, { method, body, cookie })).status, 403, `${method} ${path}`);
  }
});

test("/admin sends visitors to sign in, and old module URLs to /admin", { skip }, async () => {
  const admin = await call("/admin");
  assert.ok([302, 307].includes(admin.status), `/admin: HTTP ${admin.status}`);
  assert.match(admin.headers.get("location") ?? "", /\/signin\?callbackUrl=%2Fadmin$/);
  const old = await call("/admin/billing");
  assert.ok([302, 307, 308].includes(old.status));
  assert.match(old.headers.get("location") ?? "", /\/admin$/);
});

// Signs in with @supabase/ssr exactly as the browser does and returns the cookie header.
async function signIn(email, password) {
  const { createServerClient } = await import("@supabase/ssr");
  const jar = new Map();
  const supabase = createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

const hasLogin = (role) => Boolean(base && process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env[`TEST_${role}_EMAIL`] && process.env[`TEST_${role}_PASSWORD`]);

test("an admin without full access cannot manage access", { skip: !hasLogin("INVESTOR") && "set TEST_INVESTOR_EMAIL/_PASSWORD" }, async () => {
  const cookie = await signIn(process.env.TEST_INVESTOR_EMAIL, process.env.TEST_INVESTOR_PASSWORD);
  assert.equal((await call("/api/admin/access", { cookie })).status, 403);
  assert.equal((await call("/api/admin/access", { method: "PATCH", body: { userId: "00000000-0000-0000-0000-000000000000", access: "partner" }, cookie })).status, 403);
  const prefs = await call("/api/admin/preferences", { cookie });
  assert.equal(prefs.status, 200);
  assert.ok(Array.isArray((await prefs.json()).columns));
  assert.equal((await call("/admin", { cookie })).status, 200);
});

test("a partner or IT admin can read the Access and CPO lists", { skip: !hasLogin("PARTNER") && "set TEST_PARTNER_EMAIL/_PASSWORD" }, async () => {
  const cookie = await signIn(process.env.TEST_PARTNER_EMAIL, process.env.TEST_PARTNER_PASSWORD);
  const access = await call("/api/admin/access", { cookie });
  assert.equal(access.status, 200);
  const data = await access.json();
  assert.ok(Array.isArray(data.admins) && data.admins.length > 0);
  assert.ok(data.levels.some((l) => l.full));
  assert.equal((await call("/api/admin/cpo-numbers", { cookie })).status, 200);
});
