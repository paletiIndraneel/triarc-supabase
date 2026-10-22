import { getCmsConfig, getMeterValues, getOperatorData } from "./operator";
import { parseMeterValues } from "./liveMetrics";
import type { Connector } from "./provider";
import { getServiceClient } from "@/lib/supabase/service";

// ChargeMOD (CMS + OCPI, in ./operator), switched on by CMS_OPERATOR_DASHBOARD_ENABLED and
// configured by the CMS_* env vars. A template for other platforms' connectors.
// The shared ChargeMOD login token (cms_session) is read and written with the server-only
// secret-key client, so it never passes through a signed-in admin's own session; until
// SUPABASE_SECRET_KEY is set it falls back to that session.
export const chargemod: Connector = {
  async connect(supabase) {
    const config = await getCmsConfig();
    if (!config.enabled) return null;
    const store = (await getServiceClient()) ?? supabase;
    return {
      async fetchSessions(query) {
        const data = await getOperatorData(config, store, { page: 1, perPage: 100, ...query });
        return {
          transactions: data.transactions.transactions,
          active: data.active.transactions,
          errors: data.transactions.sourceErrors,
          dashboard: data.dashboard,
        };
      },
      async fetchMeterReadings(sessionId) {
        const payload = await getMeterValues({ ...config, store }, sessionId);
        return { payload, readings: parseMeterValues(payload) };
      },
    };
  },
};
