import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getCmsConfig, getCmsErrorMessage, getMeterValues } from "@/lib/cms/operator";
import { liveMetrics, parseMeterValues, type LiveMetrics } from "@/lib/cms/liveMetrics";

export const dynamic = "force-dynamic";

const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; metrics: LiveMetrics; payload: unknown; readings: ReturnType<typeof parseMeterValues> }>();

export async function GET(_request: Request, context: { params: Promise<{ transactionId: string }> }) {
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const config = await getCmsConfig();
  if (!config.enabled) return new NextResponse("Not Found", { status: 404 });

  const { transactionId } = await context.params;
  if (!/^[\w-]{1,80}$/.test(transactionId)) return new NextResponse("Bad Request", { status: 400 });

  const hit = cache.get(transactionId);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ ...hit.metrics, transactionDetails: hit.payload, parsedReadings: hit.readings });
  }

  try {
    const payload = await getMeterValues({ ...config, store: supabase }, transactionId);
    const readings = parseMeterValues(payload);
    const metrics = liveMetrics(readings);

    // Keep the latest raw API payload and normalized readings on the existing transaction row.
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
    if (saveError) {
      // Live metrics should remain available even if persistence is temporarily unavailable.
      console.error("[cms/live] saving latest meter-values response failed:", saveError.message);
    }

    cache.set(transactionId, { at: Date.now(), metrics, payload, readings });
    if (cache.size > 50) cache.delete(cache.keys().next().value!);
    return NextResponse.json({ ...metrics, transactionDetails: payload, parsedReadings: readings });
  } catch (error) {
    console.error("[cms/live]", error);
    return NextResponse.json({ error: getCmsErrorMessage(error) }, { status: 502 });
  }
}
