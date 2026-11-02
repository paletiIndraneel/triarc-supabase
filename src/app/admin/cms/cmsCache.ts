import { supabase } from "@/lib/supabase/billing";
import { SESSION_COLUMNS, SESSIONS_TABLE, fromStoredRow } from "@/lib/cms/transactionStore";
import type { CmsTransaction, CmsTransactionRow } from "@/lib/cms/types";
import type { CmsColumnId } from "./transactionFilters";

// Sessions saved in SESSIONS_TABLE that started in [from, to), oldest first.
export async function readStoredFromBrowser(from: string, to: string) {
  const rows: CmsTransactionRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      // Avoid transferring the large historical meter-values JSON for every dashboard load.
      .select(SESSION_COLUMNS)
      .gte("started_at", from)
      .lt("started_at", to)
      .order("started_at")
      .order("transaction_id")
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as CmsTransactionRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows.map(fromStoredRow);
}

export type Dashboard = {
  summary: Record<string, unknown>;
  chart: Record<string, unknown>;
  chargers: Record<string, unknown>;
  locations: Record<string, unknown>;
};

export type Transaction = CmsTransaction;

export type TransactionResponse = {
  transactions?: Transaction[];
  count?: number;
};

export type ActiveTransactionResponse = {
  transactions?: Transaction[];
  count?: number;
};

export type CmsCache = {
  transactions: Transaction[];
  coverage: Array<{ startDate: string; endDate: string }>;
  // Kept with the rows so a reload served from cache still shows locations and live sessions.
  dashboard?: Dashboard;
  active?: ActiveTransactionResponse;
};

export const CMS_CACHE_KEY = "triarc-cms-transaction-cache-v8";
export const CMS_BACKFILL_KEY = "triarc-cms-history-backfill-2026-07-v1";

export function readCmsCache(): CmsCache {
  if (typeof window === "undefined") return { transactions: [], coverage: [] };
  try {
    const raw = window.sessionStorage.getItem(CMS_CACHE_KEY);
    if (!raw) return { transactions: [], coverage: [] };
    const parsed = JSON.parse(raw) as Partial<CmsCache>;
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      coverage: Array.isArray(parsed.coverage) ? parsed.coverage : [],
      dashboard: parsed.dashboard,
      active: parsed.active,
    };
  } catch {
    return { transactions: [], coverage: [] };
  }
}

export function writeCmsCache(cache: CmsCache) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CMS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function mergeTransactionData(existing: Transaction, incoming: Transaction): Transaction {
  const merged = { ...existing, ...incoming };
  const existingEnergy = existing.energyKwh;
  const incomingEnergy = incoming.energyKwh;
  const existingRevenue = existing.tariffAmount;
  const incomingRevenue = incoming.tariffAmount;

  // Prefer a positive fresh value over a cached zero, but don't let a later
  // zero from an incomplete active-session response erase a known positive value.
  if (typeof incomingEnergy === "number" && incomingEnergy > 0) {
    merged.energyKwh = incomingEnergy;
  } else if (typeof existingEnergy === "number" && existingEnergy > 0) {
    merged.energyKwh = existingEnergy;
  }

  if (typeof incomingRevenue === "number" && incomingRevenue > 0) {
    merged.tariffAmount = incomingRevenue;
  } else if (typeof existingRevenue === "number" && existingRevenue > 0) {
    merged.tariffAmount = existingRevenue;
  }

  // Retain useful existing values when the incoming record is incomplete.
  for (const [field, value] of Object.entries(incoming)) {
    const incomingMissing = value == null || value === "" || value === "Unknown";
    const existingValue = (existing as unknown as Record<string, unknown>)[field];
    const existingMissing =
      existingValue == null || existingValue === "" || existingValue === "Unknown";
    if (incomingMissing && !existingMissing) {
      (merged as unknown as Record<string, unknown>)[field] = existingValue;
    } else if (
      (field === "startedAt" || field === "stoppedAt") &&
      typeof existingValue === "string" &&
      typeof value === "string" &&
      existingValue.length > value.length
    ) {
      (merged as unknown as Record<string, unknown>)[field] = existingValue;
    }
  }

  return merged;
}

export function mergeCmsTransactions(existing: Transaction[], incoming: Transaction[]) {
  const merged = new Map<string, Transaction>();
  for (const transaction of existing) {
    const key = transaction.transactionId || transaction.id;
    if (key) merged.set(key, transaction);
  }
  for (const transaction of incoming) {
    const key = transaction.transactionId || transaction.id;
    if (!key) continue;
    const previous = merged.get(key);
    merged.set(key, previous ? mergeTransactionData(previous, transaction) : transaction);
  }
  return Array.from(merged.values());
}

// The metric window always ends at "now", so an exact end match would never hit the
// cache. Data up to this old is reused; Refresh forces a fetch.
export const CMS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

export function rangeIsCovered(
  coverage: CmsCache["coverage"],
  startDate: string,
  endDate: string
) {
  const requestedStart = new Date(startDate).getTime();
  const requestedEnd = new Date(endDate).getTime();
  return coverage.some((range) => {
    const start = new Date(range.startDate).getTime();
    const end = new Date(range.endDate).getTime();
    return start <= requestedStart && end >= requestedEnd - CMS_CACHE_MAX_AGE_MS;
  });
}

// React runs mount effects twice in development and quick filter changes can overlap;
// requests for the same window in flight share one fetch. The window's end is "now",
// so it is keyed by its start only.
export const inFlightOperatorRequests = new Map<string, Promise<{ ok: boolean; data: unknown }>>();

export function fetchOperatorData(query: string, key: string) {
  let request = inFlightOperatorRequests.get(key);
  if (!request) {
    request = fetch(`/api/cms/operator?${query}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await response.json() }))
      .finally(() => inFlightOperatorRequests.delete(key));
    inFlightOperatorRequests.set(key, request);
  }
  return request;
}


// Switching modules remounts the dashboard, so these answers are kept for the tab instead of
// re-requested on every switch. CPO number matches (only consulted when ChargeMOD leaves a
// transaction's type empty) live in ./cpoNumbersCache, which CPO Settings clears on save.
// Column preferences are refreshed after CMS_CACHE_MAX_AGE_MS and updated on save.
export let columnPrefsMemo: { at: number; value: Promise<unknown> } | null = null;
export const memoFresh = (memo: { at: number } | null) => Boolean(memo && Date.now() - memo.at < CMS_CACHE_MAX_AGE_MS);

export function rememberColumnPreferences(columns: CmsColumnId[]) {
  columnPrefsMemo = { at: Date.now(), value: Promise.resolve(columns) };
}

export function fetchColumnPreferences(): Promise<unknown> {
  if (!memoFresh(columnPrefsMemo)) {
    const value = fetch("/api/admin/preferences", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ columns?: unknown }>) : null))
      .then((data) => data?.columns ?? null)
      .catch(() => null);
    columnPrefsMemo = { at: Date.now(), value };
    // Don't keep a failed answer.
    void value.then((columns) => { if (columns === null) columnPrefsMemo = null; });
  }
  return columnPrefsMemo!.value;
}


// The CMS dashboard and the admin Overview share the full available history window
// through now and its sessionStorage cache, so opening both costs one ChargeMOD call.
// onStored gets something to show while the live request runs: this tab's older cached copy,
// or else what the database already holds (no ChargeMOD call). It is not called on Refresh
// or when the cache is fresh, and the live result always follows.
export async function loadCmsWindow(
  forceRefresh = false,
  onStored?: (cache: CmsCache) => void
): Promise<CmsCache> {
  const nowForMetrics = new Date();
  // Load CMS history from 6 July 2026 at 00:00 IST, staying within the API's 370-day limit.
  const metricFetchStart = new Date("2026-07-06T00:00:00+05:30");
  const metricFetchRange = {
    startDate: metricFetchStart.toISOString(),
    endDate: nowForMetrics.toISOString(),
  };
  let cache = readCmsCache();

  // Keep the last known-good data visible during Refresh; force only bypasses the
  // freshness check and starts a new live sync.
  if (!forceRefresh && rangeIsCovered(cache.coverage, metricFetchRange.startDate, metricFetchRange.endDate)) return cache;

  const params = new URLSearchParams({
    page: "1",
    perPage: "100",
    startDate: metricFetchRange.startDate,
    endDate: metricFetchRange.endDate,
  });
  // Request the one-time historical backfill until a successful response completes it.
  const shouldBackfill = typeof window !== "undefined" &&
    window.localStorage.getItem(CMS_BACKFILL_KEY) !== "done";
  if (shouldBackfill) params.set("backfill", "1");

  // Show the existing database/cache copy before contacting ChargeMOD. The external
  // dashboard endpoints can be slow, but stored transactions are enough to render the
  // Overview and transaction table while the live sync refreshes in the background.
  if (onStored) {
    if (cache.transactions.length) {
      onStored(cache);
    } else {
      try {
        const transactions = await readStoredFromBrowser(
          metricFetchRange.startDate,
          metricFetchRange.endDate
        );
        if (transactions.length) {
          const newest = transactions.reduce<string | null>(
            (latest, t) => (t.startedAt && (!latest || t.startedAt > latest) ? t.startedAt : latest),
            null
          );
          cache = {
            transactions,
            coverage: [{
              startDate: metricFetchRange.startDate,
              endDate: newest ?? metricFetchRange.startDate,
            }],
            dashboard: { summary: {}, chart: {}, chargers: {}, locations: {} },
            active: {},
          };
          onStored(cache);
        }
      } catch {
        // The live request still runs if stored history is unavailable.
      }
    }
  }

  // Only after the stored copy has had a chance to render do we start the slower live sync.
  const response = await fetchOperatorData(params.toString(), metricFetchRange.startDate);

  const data = response.data as {
    error?: string;
    dashboard?: Dashboard;
    transactions?: TransactionResponse & {
      coverage?: { startDate: string; endDate: string };
    };
    active?: ActiveTransactionResponse;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "CMS request failed.");
  }

  if (shouldBackfill && typeof window !== "undefined") {
    window.localStorage.setItem(CMS_BACKFILL_KEY, "done");
  }

  const dashboardData = data.dashboard;
  if (!dashboardData) {
    throw new Error(data.error ?? "CMS dashboard data was not returned.");
  }

  const incoming = data.transactions?.transactions ?? [];
  const coverage = data.transactions?.coverage ?? metricFetchRange;

  cache = {
    transactions: mergeCmsTransactions(cache.transactions, incoming),
    coverage: [...cache.coverage, coverage],
    dashboard: dashboardData,
    active: data.active ?? {},
  };
  writeCmsCache(cache);
  return cache;
}
