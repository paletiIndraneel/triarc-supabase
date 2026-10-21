import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getChargingProvider, providerErrorMessage } from "@/lib/cms/provider";
import { backfillWindow, saveMeterReadings, storedRows, upsertStoredRows } from "@/lib/cms/transactionStore";

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
export async function POST(request: Request) {
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const provider = await getChargingProvider(supabase);
  if (!provider) return new NextResponse("Not Found", { status: 404 });

  const body = await request.json().catch(() => ({})) as {
    stage?: unknown; from?: unknown; to?: unknown; limit?: unknown; exclude?: unknown;
  };
  const range = backfillWindow(body.from, body.to);
  if (!range) return NextResponse.json({ error: "Invalid backfill window." }, { status: 400 });

  if (body.stage === "transactions") {
    try {
      const data = await provider.fetchSessions({ startDate: range.from, endDate: range.to });
      const rows = storedRows(data.active.transactions, data.transactions.transactions, new Date().toISOString());
      const { written, error } = await upsertStoredRows(supabase, rows);
      const report = {
        retrieved: data.transactions.sources,
        retrievedActive: data.active.sources,
        sessions: rows.length,
        synced: written,
        sourceErrors: data.transactions.sourceErrors,
      };
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
    const pending = () =>
      supabase
        .from("cms_transactions")
        .select("transaction_id", { count: "exact" })
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
      if (!transactionId) continue;

      try {
        const saveError = await saveMeterReadings(supabase, transactionId, await provider.fetchMeterReadings(transactionId));
        if (saveError) throw new Error(`Saving failed: ${saveError}`);
        succeeded += 1;
      } catch (error) {
        const message = providerErrorMessage(error);
        failures.push({ transactionId, error: message });
        if (/\b429\b|too many requests|rate.?limit/i.test(message)) {
          rateLimited = true;
          console.warn("[cms/backfill] ChargeMOD rate limit reached; stopping this batch early.");
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
