import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getChargingProviders, providerErrorMessage, type MeterResult } from "@/lib/cms/provider";
import { saveMeterReadings, SESSIONS_TABLE } from "@/lib/cms/transactionStore";

export const dynamic = "force-dynamic";

const CACHE_MS = 15_000;
const cache = new Map<string, { at: number } & MeterResult>();

// Live meter readings for one session, by its stored id (with the platform prefix).
export async function GET(_request: Request, context: { params: Promise<{ transactionId: string }> }) {
  const { supabase, user, stationIds } = await getAdminClient();
  if (!user) return new NextResponse("Forbidden", { status: 403 });

  const providers = await getChargingProviders(supabase);
  if (!providers.length) return new NextResponse("Not Found", { status: 404 });

  const { transactionId } = await context.params;
  if (!/^[\w-]{1,80}$/.test(transactionId)) return new NextResponse("Bad Request", { status: 400 });

  // Read with the user's own client: a station-limited investor sees only their stations'
  // sessions, so a session they cannot read is refused (before the cache, so nothing leaks).
  const { data: row } = await supabase.from(SESSIONS_TABLE).select("provider").eq("transaction_id", transactionId).maybeSingle();
  if (stationIds && !row) return new NextResponse("Forbidden", { status: 403 });

  const hit = cache.get(transactionId);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ ...hit.metrics, transactionDetails: hit.payload, parsedReadings: hit.readings });
  }

  // The session's platform: from its stored row, else the one whose id prefix it carries.
  const provider =
    providers.find((p) => p.id === row?.provider) ??
    providers.find((p) => p.idPrefix && transactionId.startsWith(p.idPrefix));
  if (!provider?.fetchMeterReadings) {
    return NextResponse.json({ error: `Live readings are not available for ${provider?.label ?? "this session"}.` }, { status: 404 });
  }

  try {
    const meter = await provider.fetchMeterReadings(transactionId);

    // Keep the latest raw API payload and normalized readings on the existing session row.
    const saveError = await saveMeterReadings((await getServiceClient()) ?? supabase, transactionId, meter);
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
