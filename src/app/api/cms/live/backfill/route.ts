import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getCmsConfig, getCmsErrorMessage, getMeterValues } from "@/lib/cms/operator";
import { liveMetrics, parseMeterValues } from "@/lib/cms/liveMetrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 10;
const REQUEST_SPACING_MS = 1500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const config = await getCmsConfig();
  if (!config.enabled) return new NextResponse("Not Found", { status: 404 });

  try {
    const body = await request.json().catch(() => ({})) as { limit?: unknown };
    const requested = Number(body.limit ?? DEFAULT_BATCH_SIZE);
    const limit = Number.isFinite(requested)
      ? Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(requested)))
      : DEFAULT_BATCH_SIZE;

    const { data: rows, error } = await supabase
      .from("cms_transactions")
      .select("transaction_id")
      .is("meter_values_fetched_at", null)
      .not("transaction_id", "is", null)
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
        const payload = await getMeterValues({ ...config, store: supabase }, transactionId);
        const readings = parseMeterValues(payload);
        const metrics = liveMetrics(readings);
        const { error: saveError } = await supabase
          .from("cms_transactions")
          .update({
            meter_values_response: payload as never,
            meter_values_readings: readings as never,
            current_soc: metrics.currentSoc,
            meter_values_last_reading_at: metrics.lastReadingAt,
            meter_values_fetched_at: new Date().toISOString(),
          })
          .eq("transaction_id", transactionId);

        if (saveError) throw new Error(saveError.message);
        succeeded += 1;
      } catch (error) {
        const message = getCmsErrorMessage(error);
        failures.push({ transactionId, error: message });
        if (/\b429\b|too many requests|rate.?limit/i.test(message)) {
          rateLimited = true;
          console.warn("[cms/backfill] ChargeMOD rate limit reached; stopping this batch early.");
        }
      }
    }

    const { count, error: countError } = await supabase
      .from("cms_transactions")
      .select("transaction_id", { count: "exact", head: true })
      .is("meter_values_fetched_at", null);

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
    return NextResponse.json({ error: getCmsErrorMessage(error) }, { status: 502 });
  }
}
