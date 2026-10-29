import type { SupabaseClient } from "@supabase/supabase-js";
import { getCmsErrorMessage } from "./operator";
import { liveMetrics, type LiveMetrics, type MeterReading } from "./liveMetrics";
import { PROVIDERS, platformSessionId, storedSessionId, type ProviderInfo } from "./providerIds";
import type { CmsTransaction } from "./types";
import { chargemod } from "./chargemod";

// The charging platforms behind the admin. API routes get sessions and meter readings only
// through here, so the routes, the database, the CMS dashboard, Overview and billing stay
// the same when a platform is added or removed.
//
// To add one (e.g. Ather): add it to PROVIDERS in ./providerIds, write a connector file like
// ./chargemod.ts that returns sessions as CmsTransaction (./types; set `type: "CPO"` on the
// platform's own-use sessions) and, if the platform has them, meter readings as MeterReading
// (./liveMetrics), then list it in CONNECTORS below. Its settings come from its own env vars.

export type SessionQuery = {
  startDate: string;
  endDate: string;
  page?: number;
  perPage?: number;
  searchField?: string;
  searchKey?: string;
};

export type ProviderSessions = {
  transactions: CmsTransaction[]; // sessions that started in the window
  active: CmsTransaction[]; // sessions charging now
  errors: string[]; // parts that failed without failing the whole fetch (e.g. ChargeMOD's OCPI)
  dashboard?: unknown; // the platform's own summary, if it has one (ChargeMOD's locations etc.)
};

// What a connector file provides. Ids it receives and returns are the platform's own.
export type Connector = {
  // null when the platform is switched off or its env vars are missing.
  connect(supabase: SupabaseClient): Promise<{
    fetchSessions(query: SessionQuery): Promise<ProviderSessions>;
    // Leave out when the platform has no live meter readings.
    fetchMeterReadings?(sessionId: string): Promise<{ payload: unknown; readings: MeterReading[] }>;
  } | null>;
};

const CONNECTORS: Record<string, Connector> = { chargemod };

// The platforms switched on in the Platforms page (provider_settings). Null when that cannot be
// read — the table is missing mid-rollout, or RLS refused it — and then every platform is left
// as its env vars say, rather than stopping the dashboard: this gate only governs reading from
// a platform, so failing open keeps today's behaviour and failing shut would show nothing.
async function enabledPlatforms(supabase: SupabaseClient): Promise<Set<string> | null> {
  const { data, error } = await supabase.from("provider_settings").select("provider, enabled");
  if (error || !data) return null;
  return new Set(data.filter((row) => row.enabled).map((row) => row.provider as string));
}

export type MeterResult = {
  payload: unknown; // the platform's raw response, stored as-is in meter_values_response
  readings: MeterReading[];
  metrics: LiveMetrics;
};

export type ChargingProvider = ProviderInfo & {
  fetchSessions(query: SessionQuery): Promise<ProviderSessions>;
  fetchMeterReadings: ((storedId: string) => Promise<MeterResult>) | null;
};

const stamp = (info: ProviderInfo, t: CmsTransaction): CmsTransaction => ({
  ...t,
  provider: info.id,
  id: storedSessionId(info, t.id),
  transactionId: storedSessionId(info, t.transactionId),
});

// The platforms that are switched on, in PROVIDERS order: enabled in provider_settings and
// holding credentials. Empty when none is.
// `supabase` is the signed-in admin's client (ChargeMOD shares its login token through it).
export async function getChargingProviders(supabase: SupabaseClient): Promise<ChargingProvider[]> {
  // Both have to agree: enabled here and credentials on the Worker.
  const enabled = await enabledPlatforms(supabase);
  const providers = await Promise.all(
    PROVIDERS.map(async (info): Promise<ChargingProvider | null> => {
      if (enabled && !enabled.has(info.id)) return null;
      const connection = await CONNECTORS[info.id]?.connect(supabase);
      if (!connection) return null;
      const meters = connection.fetchMeterReadings?.bind(connection);
      return {
        ...info,
        fetchSessions: async (query) => {
          const data = await connection.fetchSessions(query);
          return {
            ...data,
            transactions: data.transactions.map((t) => stamp(info, t)),
            active: data.active.map((t) => stamp(info, t)),
          };
        },
        fetchMeterReadings: meters
          ? async (storedId) => {
              const { payload, readings } = await meters(platformSessionId(info, storedId));
              return { payload, readings, metrics: liveMetrics(readings) };
            }
          : null,
      };
    })
  );
  return providers.filter((p): p is ChargingProvider => p !== null);
}

export const providerErrorMessage = getCmsErrorMessage;
