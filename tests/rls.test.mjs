// Runs supabase/tests/rls.test.sql against a Supabase project through the Management API.
// The SQL always rolls back (see its header), so it is safe on the live project.
// Skipped unless SUPABASE_ACCESS_TOKEN (a personal access token) and SUPABASE_PROJECT_REF are set.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;

test("RLS: each kind of user reads and changes only what it may", { skip: !(token && ref) && "set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF" }, async () => {
  const query = await readFile(new URL("../supabase/tests/rls.test.sql", import.meta.url), "utf8");
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  // The script ends by raising its result, so a passing run is reported as a SQL error too.
  const text = await response.text();
  const result = text.match(/RLS (OK|FAILED):[^"\\]*/)?.[0];
  assert.ok(result, `Unexpected response (HTTP ${response.status}): ${text.slice(0, 500)}`);
  if (result.includes("Known gaps")) console.warn(result.slice(result.indexOf("Known gaps")));
  assert.match(result, /^RLS OK/, result);
});
