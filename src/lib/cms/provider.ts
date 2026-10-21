import type { SupabaseClient } from "@supabase/supabase-js";
import { getCmsConfig, getCmsErrorMessage, getMeterValues, getOperatorData } from "./operator";
import { liveMetrics, parseMeterValues, type LiveMetrics, type MeterReading } from "./liveMetrics";

// The charging-data provider behind the admin (today ChargeMOD, CMS + OCPI, in ./operator).
// API routes get sessions and meter readings only through here. To change or add a provider,
// change this file and keep what it returns: sessions as CmsTransaction (./types), readings
// as MeterReading (./liveMetrics). Routes, the database and the dashboard then stay as they are.

export type SessionQuery = {
  startDate: string;
  endDate: string;
  page?: number;
  perPage?: number;
  searchField?: string;
  searchKey?: string;
};

export type MeterResult = {
  payload: unknown; // the provider's raw response, stored as-is in meter_values_response
  readings: MeterReading[];
  metrics: LiveMetrics;
};

// Null when the CMS dashboard is switched off (CMS_OPERATOR_DASHBOARD_ENABLED).
// `supabase` is the signed-in admin's client; ChargeMOD shares its login token through it.
export async function getChargingProvider(supabase: SupabaseClient) {
  const config = await getCmsConfig();
  if (!config.enabled) return null;
  const withStore = { ...config, store: supabase };

  return {
    // Sessions in the window plus the sessions charging now, merged across sources.
    fetchSessions: (query: SessionQuery) =>
      getOperatorData(config, supabase, { page: 1, perPage: 100, ...query }),

    fetchMeterReadings: async (transactionId: string): Promise<MeterResult> => {
      const payload = await getMeterValues(withStore, transactionId);
      const readings = parseMeterValues(payload);
      return { payload, readings, metrics: liveMetrics(readings) };
    },
  };
}

export type ChargingProvider = NonNullable<Awaited<ReturnType<typeof getChargingProvider>>>;

export const providerErrorMessage = getCmsErrorMessage;
