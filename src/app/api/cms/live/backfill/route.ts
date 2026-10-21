import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getChargingProviders, providerErrorMessage } from "@/lib/cms/provider";
import { backfillWindow, saveMeterReadings, SESSIONS_TABLE, storedRows, upsertStoredRows } from "@/lib/cms/transactionStore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 10;
const REQUEST_SPACING_MS = 1500;
const MAX_EXCLUDED = 500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The history backfill button, in two stages over one fixed window chosen by the browser:
// "transactions" fetches and stores every session of the window, then "meters" fetches
// meter values, a batch at a time, for the window's finished sessions that have none yet.
// Every switched-on platform is included; meters only for platforms that have them.
export async function POST(request: Request) {
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const providers = await getChargingProviders(supabase);
  if (!providers.length) return new NextResponse("Not Found", { status: 404 });

  const body = await request.json().catch(() => ({})) as {
    stage?: unknown; from?: unknown; to?: unknown; limit?: unknown; exclude?: unknown;
  };
  const range = backfillWindow(body.from, body.to);
  if (!range) return NextResponse.json({ error: "Invalid backfill window." }, { status: 400 });

  if (body.stage === "transactions") {
    try {
      // A platform that fails is reported in sourceErrors; the others are still saved.
      const results = await Promise.allSettled(
        providers.map((p) => p.fetchSessions({ startDate: range.from, endDate: range.to }))
      );
      if (!results.some((r) => r.status === "fulfilled")) throw results.find((r) => r.status === "rejected")?.reason;
      const syncedAt = new Date().toISOString();
      const retrieved: Record<string, number> = {};
      const sourceErrors: string[] = [];
      const rows = results.flatMap((r, i) => {
        const { label } = providers[i];
        if (r.status === "rejected") {
          sourceErrors.push(`${label}: ${providerErrorMessage(r.reason)}`);
          return [];
        }
        retrieved[label] = r.value.transactions.length;
        sourceErrors.push(...r.value.errors.map((e) => `${label}: ${e}`));
        return storedRows(r.value.active, r.value.transactions, syncedAt);
      });
      const { written, error } = await upsertStoredRows(supabase, rows);
      const report = { retrieved, sessions: rows.length, synced: written, sourceErrors };
      if (error) {
        console.error("[cms/backfill] saving transactions failed:", error);
        return NextResponse.json({ ...report, error: `Saving sessions failed after ${written} of ${rows.length}: ${error}` }, { status: 500 });
      }
      return NextResponse.json(report);
    } catch (error) {
      console.error("[cms/backfill] transactions", error);
      return NextResponse.json({ error: providerErrorMessage(error) }, { status: 502 });
    }
  }

  if (body.stage !== "meters") return NextResponse.json({ error: "Unknown backfill stage." }, { status: 400 });

  try {
    const requested = Number(body.limit ?? DEFAULT_BATCH_SIZE);
    const limit = Number.isFinite(requested)
      ? Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(requested)))
      : DEFAULT_BATCH_SIZE;
    // Sessions that already failed in this run, so they don't take every later batch.
    const exclude = (Array.isArray(body.exclude) ? body.exclude : [])
      .filter((id): id is string => typeof id === "string" && /^[\w-]{1,80}$/.test(id))
      .slice(0, MAX_EXCLUDED);

    // Finished sessions of the window without stored meter values. Sessions still charging
    // are left out: their readings would be stored half-way and never fetched again.
    const withMeters = providers.filter((p) => p.fetchMeterReadings);
    if (!withMeters.length) {
      return NextResponse.json({ requested: 0, succeeded: 0, failed: 0, failures: [], rateLimited: false, remaining: 0, complete: true });
    }
    const pending = () =>
      supabase
        .from(SESSIONS_TABLE)
        .select("transaction_id,provider", { count: "exact" })
        .in("provider", withMeters.map((p) => p.id))
        .is("meter_values_fetched_at", null)
        .not("stopped_at", "is", null)
        .gte("started_at", range.from)
        .lt("started_at", range.to);

    // `in.()` with an empty list is invalid, so a run with no failures uses a filter that matches all.
    const { data: rows, error } = await pending()
      .filter("transaction_id", exclude.length ? "not.in" : "not.is", exclude.length ? `(${exclude.join(",")})` : "null")
      .order("started_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Could not find transactions to backfill: ${error.message}`);

    let succeeded = 0;
    let rateLimited = false;
    const failures: Array<{ transactionId: string; error: string }> = [];

    for (const [index, row] of (rows ?? []).entries()) {
      if (rateLimited) break;
      if (index > 0) await wait(REQUEST_SPACING_MS);
      const transactionId = row.transaction_id;
      const fetchMeterReadings = withMeters.find((p) => p.id === row.provider)?.fetchMeterReadings;
      if (!transactionId || !fetchMeterReadings) continue;

      try {
        const saveError = await saveMeterReadings(supabase, transactionId, await fetchMeterReadings(transactionId));
        if (saveError) throw new Error(`Saving failed: ${saveError}`);
        succeeded += 1;
      } catch (error) {
        const message = providerErrorMessage(error);
        failures.push({ transactionId, error: message });
        if (/\b429\b|too many requests|rate.?limit/i.test(message)) {
          rateLimited = true;
          console.warn(`[cms/backfill] ${row.provider} rate limit reached; stopping this batch early.`);
        }
      }
    }

    const { count, error: countError } = await pending().limit(1);
    if (countError) console.error("[cms/backfill] remaining count failed:", countError.message);

    return NextResponse.json({
      requested: rows?.length ?? 0,
      succeeded,
      failed: failures.length,
      failures,
      rateLimited,
      remaining: countError ? null : count,
      complete: !countError && count === 0,
    });
  } catch (error) {
    console.error("[cms/backfill]", error);
    return NextResponse.json({ error: providerErrorMessage(error) }, { status: 502 });
  }
}
