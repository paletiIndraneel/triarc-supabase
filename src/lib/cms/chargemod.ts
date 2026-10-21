import { getCmsConfig, getMeterValues, getOperatorData } from "./operator";
import { parseMeterValues } from "./liveMetrics";
import type { Connector } from "./provider";

// ChargeMOD (CMS + OCPI, in ./operator), switched on by CMS_OPERATOR_DASHBOARD_ENABLED and
// configured by the CMS_* env vars. A template for other platforms' connectors.
export const chargemod: Connector = {
  async connect(supabase) {
    const config = await getCmsConfig();
    if (!config.enabled) return null;
    return {
      async fetchSessions(query) {
        const data = await getOperatorData(config, supabase, { page: 1, perPage: 100, ...query });
        return {
          transactions: data.transactions.transactions,
          active: data.active.transactions,
          errors: data.transactions.sourceErrors,
          dashboard: data.dashboard,
        };
      },
      async fetchMeterReadings(sessionId) {
        const payload = await getMeterValues({ ...config, store: supabase }, sessionId);
        return { payload, readings: parseMeterValues(payload) };
      },
    };
  },
};
