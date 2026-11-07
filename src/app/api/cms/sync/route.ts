import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/cms/operator";
import { getChargingProviders, providerErrorMessage } from "@/lib/cms/provider";
import { readResumePoint, scheduledSyncStart, storedRows, upsertStoredRows } from "@/lib/cms/transactionStore";
import { getServiceClient } from "@/lib/supabase/service";
import { sameSecret } from "@/lib/security";

export const dynamic = "force-dynamic";

// The Worker's schedule (custom-worker.ts) calls this, so sessions are saved and finish properly
// even when nobody opens the admin. Not a person's route: it has its own secret, CMS_SYNC_SECRET.
export async function POST(request: Request) {
  const env = await getRuntimeEnv();
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!sameSecret(given, String(env.CMS_SYNC_SECRET ?? ""))) return new NextResponse("Forbidden", { status: 403 });

  const writer = await getServiceClient();
  if (!writer) return NextResponse.json({ error: "SUPABASE_SECRET_KEY is not set for this deployment." }, { status: 500 });

  const providers = await getChargingProviders(writer);
  const endDate = new Date().toISOString();
  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      const resume = await readResumePoint(writer, provider.id);
      // Unknown position: stop rather than fetch the whole history on every run.
      if (resume.error) throw new Error(`reading stored sessions failed: ${resume.error}`);
      const data = await provider.fetchSessions({ startDate: scheduledSyncStart(resume.newest, resume.oldestOpen), endDate });
      const rows = storedRows(data.active, data.transactions, endDate);
      const { written, error } = await upsertStoredRows(writer, rows);
      if (error) throw new Error(`saved ${written} of ${rows.length} sessions: ${error}`);
      return { provider: provider.id, saved: written, warnings: data.errors };
    })
  );

  const synced = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const errors = results.flatMap((r, i) => (r.status === "rejected" ? [`${providers[i].id}: ${providerErrorMessage(r.reason)}`] : []));
  if (errors.length) console.error("[cms/sync]", errors);
  return NextResponse.json({ synced, errors }, { status: errors.length ? 502 : 200 });
}
