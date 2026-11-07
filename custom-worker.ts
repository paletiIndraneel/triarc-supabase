// The Worker entry: OpenNext's handler for every request, plus the schedule in wrangler.jsonc,
// which runs the session sync. It goes through the app's own route so it has the same runtime
// settings as a request. Without CMS_SYNC_SECRET the route refuses and the failure is logged.
import handler from "./.open-next/worker.js";

type Env = { CMS_SYNC_SECRET?: string };
type Context = { waitUntil(promise: Promise<unknown>): void };

async function runSync(env: Env, ctx: Context) {
  const request = new Request("https://admin.internal/api/cms/sync", {
    method: "POST",
    headers: { authorization: `Bearer ${env.CMS_SYNC_SECRET ?? ""}`, "user-agent": "triarc-scheduled-sync" },
  });
  const response = await handler.fetch(request, env, ctx);
  if (!response.ok) console.error("[cms/sync] scheduled run failed:", response.status, await response.text());
}

const worker = {
  fetch: handler.fetch,
  scheduled(_event: unknown, env: Env, ctx: Context) {
    ctx.waitUntil(runSync(env, ctx));
  },
};

export default worker;
