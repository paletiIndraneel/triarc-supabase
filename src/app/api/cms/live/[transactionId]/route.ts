import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getCmsConfig, getCmsErrorMessage, getMeterValues } from "@/lib/cms/operator";
import { liveMetrics, parseMeterValues, type LiveMetrics } from "@/lib/cms/liveMetrics";

export const dynamic = "force-dynamic";

const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; metrics: LiveMetrics; readings: ReturnType<typeof parseMeterValues> }>();

export async function GET(_request: Request, context: { params: Promise<{ transactionId: string }> }) {
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const config = await getCmsConfig();
  if (!config.enabled) return new NextResponse("Not Found", { status: 404 });

  const { transactionId } = await context.params;
  if (!/^[\w-]{1,80}$/.test(transactionId)) return new NextResponse("Bad Request", { status: 400 });

  const hit = cache.get(transactionId);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ ...hit.metrics, transactionDetails: hit.readings });
  }

  try {
    const payload = await getMeterValues({ ...config, store: supabase }, transactionId);
    const readings = parseMeterValues(payload);
    const metrics = liveMetrics(readings);
    cache.set(transactionId, { at: Date.now(), metrics, readings });
    if (cache.size > 50) cache.delete(cache.keys().next().value!);
    return NextResponse.json({ ...metrics, transactionDetails: readings });
  } catch (error) {
    console.error("[cms/live]", error);
    return NextResponse.json({ error: getCmsErrorMessage(error) }, { status: 502 });
  }
}
