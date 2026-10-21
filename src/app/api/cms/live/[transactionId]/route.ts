import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getChargingProvider, providerErrorMessage, type MeterResult } from "@/lib/cms/provider";
import { saveMeterReadings } from "@/lib/cms/transactionStore";

export const dynamic = "force-dynamic";

const CACHE_MS = 15_000;
const cache = new Map<string, { at: number } & MeterResult>();

export async function GET(_request: Request, context: { params: Promise<{ transactionId: string }> }) {
  const { supabase, user } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const provider = await getChargingProvider(supabase);
  if (!provider) return new NextResponse("Not Found", { status: 404 });

  const { transactionId } = await context.params;
  if (!/^[\w-]{1,80}$/.test(transactionId)) return new NextResponse("Bad Request", { status: 400 });

  const hit = cache.get(transactionId);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ ...hit.metrics, transactionDetails: hit.payload, parsedReadings: hit.readings });
  }

  try {
    const meter = await provider.fetchMeterReadings(transactionId);

    // Keep the latest raw API payload and normalized readings on the existing transaction row.
    const saveError = await saveMeterReadings(supabase, transactionId, meter);
    if (saveError) {
      // Live metrics should remain available even if persistence is temporarily unavailable.
      console.error("[cms/live] saving latest meter-values response failed:", saveError);
    }

    cache.set(transactionId, { at: Date.now(), ...meter });
    if (cache.size > 50) cache.delete(cache.keys().next().value!);
    return NextResponse.json({ ...meter.metrics, transactionDetails: meter.payload, parsedReadings: meter.readings });
  } catch (error) {
    console.error("[cms/live]", error);
    return NextResponse.json({ error: providerErrorMessage(error) }, { status: 502 });
  }
}
