import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getCmsConfig, getCmsErrorMessage, getMeterValues } from "@/lib/cms/operator";
import { liveMetrics, parseMeterValues, type LiveMetrics } from "@/lib/cms/liveMetrics";

export const dynamic = "force-dynamic";

// Live metrics for one charging session (SoC, kW, kWh, battery estimate, time left).
// Only the calculated numbers are returned, never the raw readings or customer data.
// Answers are kept briefly per instance so several viewers cost one ChargeMOD call.
const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; metrics: LiveMetrics }>();

export async function GET(_request: Request, context: { params: Promise<{ transactionId: string }> }) {
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const config = await getCmsConfig();
  if (!config.enabled) return new NextResponse("Not Found", { status: 404 });

  const { transactionId } = await context.params;
  // ChargeMOD IDs look like 1792310502118__5154595.
  if (!/^[\w-]{1,80}$/.test(transactionId)) return new NextResponse("Bad Request", { status: 400 });

  const hit = cache.get(transactionId);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.metrics);

  try {
    const payload = await getMeterValues({ ...config, store: supabase }, transactionId);
    const metrics = liveMetrics(parseMeterValues(payload));
    cache.set(transactionId, { at: Date.now(), metrics });
    if (cache.size > 50) cache.delete(cache.keys().next().value!);
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[cms/live]", error);
    return NextResponse.json({ error: getCmsErrorMessage(error) }, { status: 502 });
  }
}
