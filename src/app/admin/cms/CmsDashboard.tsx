"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, RefreshCw, Settings2, RotateCcw, Save, Download } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { getCmsWindowSnapshot, requestCmsWindow, subscribeCmsWindow, type CmsWindowSnapshot } from "./cmsWindowStore";
import { type DatePreset, getCustomRangeIST, getDateRangeIST, istDateString } from "./dateRanges";
import {
  EMPTY_TRANSACTION_FILTERS,
  type TransactionFilters,
  chargerCurrent,
  chargerLabel,
  isCpoTransaction,
  matchesTransactionFilters,
  shortChargerLabel,
  splitActiveSessions,
  isStuckSession,
} from "./transactionFilters";
import { neutralizeCsvCell } from "@/lib/security";
import type { CmsTransaction, CmsTransactionRow } from "@/lib/cms/types";
import { fromStoredRow } from "@/lib/cms/transactionStore";
import { supabase } from "@/lib/supabase/billing";
import { getCpoMobileNumbers } from "./cpoNumbersCache";
import SessionDetails from "./SessionDetails";

// Sessions saved in cms_transactions that started in [from, to), oldest first.
async function readStoredFromBrowser(from: string, to: string) {
  const rows: CmsTransactionRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("cms_transactions")
      // Avoid transferring the large historical meter-values JSON for every dashboard load.
      .select("transaction_id,id,charger_id,connector_id,started_at,stopped_at,user_name,mobile,user_type,tag_reference,location,location_id,charger_name,station_type,type,stop_reason,energy_kwh,start_soc,end_soc,vehicle_name,vehicle_number,tariff_amount,vat,invoice_available,user_id,vehicle_id,geo_latitude,geo_longitude,id_tag,is_free,base_deductive_amount,is_alpha_guaranteed,is_time_based_tariff,start_value,stop_value,created_at,updated_at,invoice_link,organization_id,project_id,solar_type,user_email,vehicle_model_id,starting_balance,ending_balance,synced_at")
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

type Dashboard = {
  summary: Record<string, unknown>;
  chart: Record<string, unknown>;
  chargers: Record<string, unknown>;
  locations: Record<string, unknown>;
};

export type Transaction = CmsTransaction;

type TransactionResponse = {
  transactions?: Transaction[];
  count?: number;
};

type ActiveTransactionResponse = {
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

const CMS_CACHE_KEY = "triarc-cms-transaction-cache-v7";
const CMS_BACKFILL_KEY = "triarc-cms-history-backfill-2026-07-v1";

function readCmsCache(): CmsCache {
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

function writeCmsCache(cache: CmsCache) {
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
    const current = (merged as unknown as Record<string, unknown>)[field];
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

function mergeCmsTransactions(existing: Transaction[], incoming: Transaction[]) {
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
const CMS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;

function rangeIsCovered(
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
const inFlightOperatorRequests = new Map<string, Promise<{ ok: boolean; data: unknown }>>();

function fetchOperatorData(query: string, key: string) {
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
// re-requested on every switch. CPO numbers (only consulted when ChargeMOD leaves a
// transaction's type empty) live in ./cpoNumbersCache, which CPO Settings clears on save.
// Column preferences are refreshed after CMS_CACHE_MAX_AGE_MS and updated on save.
let columnPrefsMemo: { at: number; value: Promise<unknown> } | null = null;
const memoFresh = (memo: { at: number } | null) => Boolean(memo && Date.now() - memo.at < CMS_CACHE_MAX_AGE_MS);

const fetchCpoMobileNumbers = getCpoMobileNumbers;

function fetchColumnPreferences(): Promise<unknown> {
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
  if (!forceRefresh && rangeIsCovered(cache.coverage, metricFetchRange.startDate, metricFetchRange.endDate)) {
    // Keep historical data cached, but always refresh active sessions when the dashboard opens.
    // This avoids showing a stale active list for the full five-minute history-cache window.
    try {
      const response = await fetch("/api/cms/operator?activeOnly=1", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json() as {
          active?: ActiveTransactionResponse;
        };
        if (data.active?.transactions) {
          cache = {
            ...cache,
            active: data.active,
          };
          writeCmsCache(cache);
        }
      }
    } catch {
      // If the live active-session endpoint is unavailable, keep showing the last known-good cache.
    }
    return cache;
  }

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

function filterTransactionsByRange(
  source: Transaction[],
  startDate: string,
  endDate: string
) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return source.filter((transaction) => {
    if (!transaction.startedAt) return false;
    const timestamp = new Date(transaction.startedAt).getTime();
    return timestamp >= start && timestamp < end;
  });
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num(value));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type CmsColumnId =
  | "id" | "transactionId" | "chargerId" | "connectorId" | "startedAt" | "stoppedAt"
  | "userName" | "mobile" | "userType" | "tagReference" | "location" | "locationId"
  | "chargerName" | "stationType" | "stopReason" | "energyKwh" | "startSoc" | "endSoc"
  | "vehicleName" | "vehicleNumber" | "tariffAmount" | "vat" | "invoiceAvailable"
  | "userId" | "vehicleId" | "geoLatitude" | "geoLongitude" | "idTag" | "isFree"
  | "baseDeductiveAmount" | "isAlphaGuaranteed" | "isTimeBasedTariff" | "startValue"
  | "stopValue" | "createdAt" | "updatedAt";

const CMS_COLUMN_IDS: CmsColumnId[] = [
  "id", "transactionId", "chargerId", "connectorId", "startedAt", "stoppedAt",
  "userName", "mobile", "userType", "tagReference", "location", "locationId",
  "chargerName", "stationType", "stopReason", "energyKwh", "startSoc", "endSoc",
  "vehicleName", "vehicleNumber", "tariffAmount", "vat", "invoiceAvailable",
  "userId", "vehicleId", "geoLatitude", "geoLongitude", "idTag", "isFree",
  "baseDeductiveAmount", "isAlphaGuaranteed", "isTimeBasedTariff", "startValue",
  "stopValue", "createdAt", "updatedAt",
];

const CMS_COLUMNS: Array<{ id: CmsColumnId; label: string }> =
  CMS_COLUMN_IDS.map((id) => ({ id, label: id }));

const DEFAULT_CMS_COLUMNS: CmsColumnId[] = [
  "vehicleNumber",
  "startSoc",
  "endSoc",
  "startedAt",
  "userName",
  "location",
  "chargerName",
  "energyKwh",
  "stopReason",
];

function buildLocalDashboard(base: Dashboard | null, transactions: Transaction[]): Dashboard | null {
  if (!base) return null;

  const chargers = new Set(
    transactions.map((transaction) => transaction.chargerId).filter(Boolean)
  );
  const totalEnergy = transactions.reduce(
    (sum, transaction) => sum + (transaction.energyKwh ?? 0) * 1000,
    0
  );
  const totalRevenue = transactions.reduce(
    (sum, transaction) => sum + (transaction.tariffAmount ?? 0),
    0
  );
  const totalTime = transactions.reduce((sum, transaction) => {
    if (!transaction.startedAt || !transaction.stoppedAt) return sum;
    const seconds =
      (new Date(transaction.stoppedAt).getTime() -
        new Date(transaction.startedAt).getTime()) /
      1000;
    return sum + (Number.isFinite(seconds) ? Math.max(0, seconds) : 0);
  }, 0);

  return {
    ...base,
    summary: {
      ...base.summary,
      transactionCount: transactions.length,
      chargerCount: chargers.size,
      transactionDetails: {
        ...(base.summary.transactionDetails &&
        typeof base.summary.transactionDetails === "object"
          ? (base.summary.transactionDetails as Record<string, unknown>)
          : {}),
        totalEnergy,
        totalRevenue,
        totalTime,
      },
    },
  };
}

function collectionLength(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return 0;

  const object = value as Record<string, unknown>;

  for (const key of ["result", "data", "locations", "items", "list"]) {
    const nested = object[key];
    if (Array.isArray(nested)) return nested.length;
    if (nested && typeof nested === "object") {
      const count = collectionLength(nested);
      if (count > 0) return count;
    }
  }

  return 0;
}

function cleanDisplayValue(value: string, prefixes: string[]) {
  let cleaned = value.trim();

  for (const prefix of prefixes) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleaned = cleaned.slice(prefix.length).trim();
      break;
    }
  }

  return cleaned || value;
}

function displayUserName(value: string) {
  const name = value.trim();

  if (!name || /^guest user(?: undefined)?$/i.test(name)) {
    return "Guest";
  }

  const cleaned = name
    .replace(/\s+undefined$/i, "")
    .replace(/\s+user$/i, "")
    .trim();

  return cleaned || "Guest";
}

function displayLocation(value: string) {
  return cleanDisplayValue(value, ["Triarc EV hub |", "Triarc |"]);
}

function displayCharger(value: string) {
  return cleanDisplayValue(value, ["Triarc EV hub |", "Triarc |"]);
}

// CMS UI deployment: column visibility, field adding, and drag-and-drop ordering remain supported; runtime data logic unchanged.
type PeriodSplit = {
  energy: { total: number; ac: number; dc: number; cpo: number };
  revenue: { total: number; ac: number; dc: number };
};

// AC/DC energy and revenue exclude CPO sessions; the totals include them.
function splitPeriod(transactions: Transaction[], cpoMobileNumbers: Set<string>): PeriodSplit {
  const energy = { total: 0, ac: 0, dc: 0, cpo: 0 };
  const revenue = { total: 0, ac: 0, dc: 0 };
  for (const transaction of transactions) {
    const cpo = isCpoTransaction(transaction, cpoMobileNumbers);
    const current = cpo ? null : chargerCurrent(transaction);
    const kwh = Number(transaction.energyKwh);
    if (Number.isFinite(kwh) && kwh > 0) {
      energy.total += kwh;
      if (cpo) energy.cpo += kwh;
      else if (current) energy[current] += kwh;
    }
    const amount = Number(transaction.tariffAmount);
    if (Number.isFinite(amount)) {
      revenue.total += amount;
      if (current) revenue[current] += amount;
    }
  }
  return { energy, revenue };
}

const formatKwh = (value: number) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh`;

function SplitCard({ title, split }: { title: string; split: PeriodSplit | null }) {
  const rows: Array<[string, number | undefined, number | undefined]> = [
    ["AC Charger", split?.energy.ac, split?.revenue.ac],
    ["DC Charger", split?.energy.dc, split?.revenue.dc],
    ["CPO", split?.energy.cpo, undefined],
  ];
  return (
    <GlassCard className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500" title={title}>{title}</p>
      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="text-xs text-slate-500">
            <th scope="col" className="pb-2 text-left font-medium"><span className="sr-only">Charger</span></th>
            <th scope="col" className="pb-2 text-right font-medium">Energy</th>
            <th scope="col" className="pb-2 text-right font-medium">Revenue</th>
          </tr>
        </thead>
        <tbody className="font-semibold whitespace-nowrap text-slate-800">
          {rows.map(([label, kwh, amount]) => (
            <tr key={label} className={label === "CPO" ? "text-violet-700" : undefined}>
              <th scope="row" className={`py-1 text-left text-xs ${label === "CPO" ? "font-semibold text-violet-600" : "font-medium text-slate-500"}`}>{label}</th>
              <td className="py-1 text-right">{kwh === undefined ? "—" : formatKwh(kwh)}</td>
              <td className="py-1 text-right">{label === "CPO" ? "" : amount === undefined ? "—" : money(amount)}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-200 text-sm font-bold text-slate-900">
            <th scope="row" className="pt-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
            <td className="pt-2 text-right">{split ? formatKwh(split.energy.total) : "—"}</td>
            <td className="pt-2 text-right">{split ? money(split.revenue.total) : "—"}</td>
          </tr>
        </tbody>
      </table>
    </GlassCard>
  );
}

export default function CmsOperatorDashboard() {
  const [baseDashboard, setBaseDashboard] = useState<Dashboard | null>(null);
  const [monthToDateEnergy, setMonthToDateEnergy] = useState<number | null>(null);
  const [monthToDateRevenue, setMonthToDateRevenue] = useState<{ total: number; ac: number; dc: number } | null>(null);
  const [monthToDateConsumption, setMonthToDateConsumption] = useState<{ total: number; ac: number; dc: number } | null>(null);
  const [historicalConsumption, setHistoricalConsumption] = useState<{ items: Array<{ label: string; value: number }> } | null>(null);
  const [monthToDateCpoEnergy, setMonthToDateCpoEnergy] = useState<number | null>(null);
  const [totalEnergyToday, setTotalEnergyToday] = useState<number | null>(null);
  const [totalRevenueToday, setTotalRevenueToday] = useState<number | null>(null);
  const [todaySplit, setTodaySplit] = useState<PeriodSplit | null>(null);
  const [cycleSplits, setCycleSplits] = useState<Array<{ title: string; split: PeriodSplit }> | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [activeTransactions, setActiveTransactions] = useState<Transaction[]>([]);
  const [active, setActive] = useState(0);
  const [activeTransactionIds, setActiveTransactionIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [datePreset, setDatePreset] = useState<DatePreset | "custom">("today");
  const [customFrom, setCustomFrom] = useState(() => istDateString().slice(0, 8) + "01");
  const [customTo, setCustomTo] = useState(() => istDateString());
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_TRANSACTION_FILTERS);
  const [cpoMobileNumbers, setCpoMobileNumbers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState("");
  const [dataTill, setDataTill] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<CmsColumnId[]>(DEFAULT_CMS_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<CmsColumnId[]>(DEFAULT_CMS_COLUMNS);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [savingColumns, setSavingColumns] = useState(false);
  const [columnsLoaded, setColumnsLoaded] = useState(false);
  const columnEditorRef = useRef<HTMLDivElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [draggedTableColumn, setDraggedTableColumn] = useState<CmsColumnId | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);



  useEffect(() => {
    let cancelled = false;

    async function loadColumnPreferences() {
      try {
        const columns = await fetchColumnPreferences();
        if (cancelled || !Array.isArray(columns)) return;

        const valid = columns.filter(
          (column): column is CmsColumnId =>
            typeof column === "string" &&
            CMS_COLUMN_IDS.includes(column as CmsColumnId)
        );
        const nextColumns = valid.length > 0 ? valid : DEFAULT_CMS_COLUMNS;
        setVisibleColumns(nextColumns);
        setDraftColumns(nextColumns);
      } catch {
      } finally {
        if (!cancelled) setColumnsLoaded(true);
      }
    }

    void loadColumnPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveColumnPreferences(columns: CmsColumnId[]) {
    setSavingColumns(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to save table preferences.");
      columnPrefsMemo = { at: Date.now(), value: Promise.resolve(columns) };
      setVisibleColumns(columns);
      setDraftColumns(columns);
      setColumnEditorOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save table preferences.");
    } finally {
      setSavingColumns(false);
    }
  }

  function toggleColumn(column: CmsColumnId) {
    setDraftColumns((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column]
    );
  }

  function reorderTableColumn(dragged: CmsColumnId, target: CmsColumnId) {
    if (dragged === target) return;

    const fromIndex = visibleColumns.indexOf(dragged);
    const toIndex = visibleColumns.indexOf(target);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...visibleColumns];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, dragged);

    setVisibleColumns(next);
    setDraftColumns(next);
  }

  function openColumnEditor() {
    setDraftColumns(visibleColumns);
    setColumnEditorOpen((open) => !open);
  }

  function closeColumnEditor() {
    setDraftColumns(visibleColumns);
    setColumnEditorOpen(false);
  }

  useEffect(() => {
    if (!columnEditorOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        columnEditorRef.current &&
        !columnEditorRef.current.contains(target) &&
        columnMenuRef.current &&
        !columnMenuRef.current.contains(target)
      ) {
        closeColumnEditor();
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [columnEditorOpen, visibleColumns]);

  // The CMS window is loaded through cmsWindowStore, shared with Overview: a Refresh
  // started on either page is one request, and both pages follow it.
  const applyCache = useCallback(async (cache: CmsCache) => {
    try {
      // Fetch one consistent transaction window for all dashboard metrics and the
      // table; the table's date filter is applied client-side and never refetches. It covers the previous
      // calendar month and the current month-to-date.
      const cpoMobileNumbersRequest = fetchCpoMobileNumbers();
      const apply = async (cache: CmsCache) => {
      if (cache.dashboard) setBaseDashboard(cache.dashboard);
      const activeData = cache.active ?? {};

      const activeWasFetched =
        activeData.transactions !== undefined || activeData.count !== undefined;
      const currentActiveTransactions = activeData.transactions ?? [];
      setAllTransactions(cache.transactions);

      if (activeWasFetched) {
        setActiveTransactions(currentActiveTransactions);
        setActive(activeData.count ?? currentActiveTransactions.length);
        setActiveTransactionIds(
          new Set(
            currentActiveTransactions.flatMap((transaction) =>
              [transaction.transactionId, transaction.id].filter(Boolean)
            )
          )
        );
      }

      // All dashboard metrics are derived from transactions already retrieved
      // and cached locally. They do not issue separate transaction API requests,
      // and their date ranges are independent of the table's selected filter.
      try {
        const now = new Date();
        const todayRange = getDateRangeIST("today");
        const currentMonthRange = getDateRangeIST("this-month");
        const istParts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(now);
        const istValues = Object.fromEntries(istParts.map(({ type, value }) => [type, value]));
        const localYear = Number(istValues.year);
        const localMonth = Number(istValues.month);
        const localDay = Number(istValues.day);
        const currentMonthStart = new Date(`${istValues.year}-${istValues.month}-01T00:00:00+05:30`);
        const previousMonthStartDate = new Date(Date.UTC(localYear, localMonth - 2, 1));
        const previousMonthStart = new Date(
          `${previousMonthStartDate.getUTCFullYear()}-${String(previousMonthStartDate.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00+05:30`
        );
        const previousMonthMidpoint = new Date(
          `${previousMonthStartDate.getUTCFullYear()}-${String(previousMonthStartDate.getUTCMonth() + 1).padStart(2, "0")}-16T00:00:00+05:30`
        );
        const currentFirstHalfEnd = new Date(`${istValues.year}-${istValues.month}-16T00:00:00+05:30`);

        const metricMap = new Map<string, Transaction>();
        for (const transaction of [...cache.transactions, ...currentActiveTransactions]) {
          const key = transaction.transactionId || transaction.id;
          if (!key) continue;
          const existing = metricMap.get(key);
          if (!existing) {
            metricMap.set(key, transaction);
          } else {
            metricMap.set(key, mergeTransactionData(existing, transaction));
          }
        }
        const metricTransactions = Array.from(metricMap.values());
        const todayTransactions = filterTransactionsByRange(metricTransactions, todayRange.startDate, todayRange.endDate);
        setTotalEnergyToday(todayTransactions.reduce((sum, transaction) => sum + Math.max(0, transaction.energyKwh ?? 0), 0));
        setTotalRevenueToday(todayTransactions.reduce((sum, transaction) => sum + (transaction.tariffAmount ?? 0), 0));

        const cpoMobileNumbers = await cpoMobileNumbersRequest;
        setCpoMobileNumbers(cpoMobileNumbers);
        const mtdTransactions = filterTransactionsByRange(
          metricTransactions,
          currentMonthRange.startDate,
          now.toISOString()
        );
        const mtd = splitPeriod(mtdTransactions, cpoMobileNumbers);
        setMonthToDateEnergy(mtd.energy.total);
        setMonthToDateConsumption({ total: mtd.energy.total, ac: mtd.energy.ac, dc: mtd.energy.dc });
        setMonthToDateCpoEnergy(mtd.energy.cpo);
        setMonthToDateRevenue(mtd.revenue);
        setTodaySplit(splitPeriod(todayTransactions, cpoMobileNumbers));
        // Billing cycles run 1–15 and 16–end of month: show the current cycle and the one before.
        const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
        const lastDay = (start: Date) => dayFmt.format(new Date(start.getTime() - 24 * 60 * 60 * 1000));
        const nextMonthStart = new Date(Date.UTC(localYear, localMonth, 1) - 330 * 60 * 1000);
        const cycles: Array<[Date, Date]> =
          localDay <= 15
            ? [[currentMonthStart, currentFirstHalfEnd], [previousMonthMidpoint, currentMonthStart]]
            : [[currentFirstHalfEnd, nextMonthStart], [currentMonthStart, currentFirstHalfEnd]];
        setCycleSplits(
          cycles.map(([start, end], index) => ({
            title: `${index === 0 ? "Current cycle" : "Previous cycle"} (${dayFmt.format(start)} – ${lastDay(end)})`,
            split: splitPeriod(
              filterTransactionsByRange(metricTransactions, start.toISOString(), (index === 0 && end > now ? now : end).toISOString()),
              cpoMobileNumbers
            ),
          }))
        );

        const previousMonthName = previousMonthStart.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        });
        const sumEnergy = (start: Date, end: Date) =>
          filterTransactionsByRange(metricTransactions, start.toISOString(), end.toISOString())
            .reduce((sum, transaction) => sum + Math.max(0, transaction.energyKwh ?? 0), 0);
        if (localDay <= 15) {
          setHistoricalConsumption({
            items: [
              { label: previousMonthName + " (1–15)", value: sumEnergy(previousMonthStart, previousMonthMidpoint) },
              { label: previousMonthName + " (16–end)", value: sumEnergy(previousMonthMidpoint, currentMonthStart) },
            ],
          });
        } else {
          setHistoricalConsumption({
            items: [
              { label: "This month (1–15)", value: sumEnergy(currentMonthStart, currentFirstHalfEnd) },
              { label: previousMonthName + " (1–15)", value: sumEnergy(previousMonthStart, previousMonthMidpoint) },
              { label: previousMonthName + " (16–end)", value: sumEnergy(previousMonthMidpoint, currentMonthStart) },
            ],
          });
        }
      } catch {
        // Metric calculation must not prevent the dashboard from rendering.
      }
      };

      await apply(cache);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CMS request failed.");
    }
  }, []);

  useEffect(() => {
    let shownCache: CmsCache | null = null;
    const sync = ({ cache, refreshing, error }: CmsWindowSnapshot) => {
      // Stored rows are enough to render immediately; live CMS sync continues in the background.
      setLoading(refreshing && !cache);
      setMessage(error ?? "");
      if (cache && cache !== shownCache) {
        shownCache = cache;
        setDataTill(cache.coverage.at(-1)?.endDate ?? null);
        void applyCache(cache);
      }
    };
    sync(getCmsWindowSnapshot());
    const unsubscribe = subscribeCmsWindow(sync);
    void requestCmsWindow();
    return unsubscribe;
  }, [applyCache]);

  const load = useCallback((forceRefresh = false) => requestCmsWindow(forceRefresh), []);

  const startHistoricalBackfill = useCallback(async () => {
    if (backfillRunning) return;
    const confirmed = window.confirm(
      "Start historical ChargeMOD meter-values backfill? This will fetch readings for old transactions in batches and may take several minutes."
    );
    if (!confirmed) return;

    setBackfillRunning(true);
    setBackfillStatus("Starting historical backfill…");
    let totalSucceeded = 0;
    let totalFailed = 0;
    console.group("[CMS history backfill]");
    console.info("Starting historical ChargeMOD meter-values backfill.", {
      batchSize: 10,
      runLimit: 300,
      startedAt: new Date().toISOString(),
    });
    try {
      for (let batch = 1; batch <= 30; batch += 1) {
        console.info(`Batch ${batch}: requesting up to 10 transactions…`, {
          at: new Date().toISOString(),
          succeededSoFar: totalSucceeded,
          failedSoFar: totalFailed,
        });
        const response = await fetch("/api/cms/live/backfill", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ limit: 10 }),
        });
        const result = await response.json().catch(() => ({})) as {
          requested?: number;
          succeeded?: number;
          failed?: number;
          failures?: Array<{ transactionId: string; error: string }>;
          remaining?: number | null;
          complete?: boolean;
          rateLimited?: boolean;
          error?: string;
        };
        if (!response.ok) {
          console.error(`Batch ${batch} failed with HTTP ${response.status}.`, result);
          throw new Error(result.error || `Backfill request failed (HTTP ${response.status}).`);
        }

        totalSucceeded += result.succeeded ?? 0;
        totalFailed += result.failed ?? 0;
        console.info(`Batch ${batch} finished.`, {
          requested: result.requested ?? 0,
          succeeded: result.succeeded ?? 0,
          failed: result.failed ?? 0,
          remaining: result.remaining ?? null,
          totalSucceeded,
          totalFailed,
        });
        if (result.failures?.length) {
          console.warn(`Batch ${batch} transaction failures:`);
          console.table(result.failures);
        }
        setBackfillStatus(
          `Backfill running · ${totalSucceeded.toLocaleString()} fetched · ${(result.remaining ?? "unknown").toLocaleString()} remaining · ${totalFailed} failed`
        );

        if (result.rateLimited) {
          console.warn("Backfill paused because ChargeMOD rate-limited requests. Wait before restarting.", { batch, response: result });
          setBackfillStatus(`Backfill paused by ChargeMOD rate limit · ${totalSucceeded.toLocaleString()} fetched · ${(result.remaining ?? "unknown").toLocaleString()} remaining. Wait a few minutes before restarting.`);
          return;
        }

        if (result.complete) {
          const summary = {
            status: "complete",
            totalSucceeded,
            totalFailed,
            finishedAt: new Date().toISOString(),
          };
          console.info("Historical backfill complete.", summary);
          setBackfillStatus(`Backfill complete · ${totalSucceeded.toLocaleString()} fetched · ${totalFailed} failed`);
          return;
        }
        if (!result.requested || !(result.succeeded ?? 0)) {
          console.warn("Backfill paused because this batch made no successful progress.", {
            batch,
            response: result,
          });
          setBackfillStatus(
            `Backfill paused · ${totalSucceeded} fetched · ${totalFailed} failed. Check the error details or retry after fixing the issue.`
          );
          return;
        }
      }
      console.warn("Backfill paused after reaching the 300-record run limit.", {
        totalSucceeded,
        totalFailed,
        at: new Date().toISOString(),
      });
      setBackfillStatus(`Backfill paused after 300-record run limit · ${totalSucceeded} fetched · ${totalFailed} failed. Click again to continue.`);
    } catch (error) {
      console.error("Historical backfill stopped due to an error.", error);
      setBackfillStatus(error instanceof Error ? `Backfill stopped: ${error.message}` : "Backfill stopped due to an unknown error.");
    } finally {
      console.info("Historical backfill execution ended.", {
        totalSucceeded,
        totalFailed,
        endedAt: new Date().toISOString(),
      });
      console.groupEnd();
      setBackfillRunning(false);
    }
  }, [backfillRunning]);

  const transactions = useMemo(() => {
    const dateRange =
      datePreset === "custom" ? getCustomRangeIST(customFrom, customTo) : getDateRangeIST(datePreset);
    const filtered = filterTransactionsByRange(allTransactions, dateRange.startDate, dateRange.endDate);
    const live = activeTransactions.filter(
      (activeTransaction) =>
        !filtered.some(
          (transaction) =>
            (transaction.transactionId && transaction.transactionId === activeTransaction.transactionId) ||
            (transaction.id && transaction.id === activeTransaction.id)
        )
    );
    const isLive = (transaction: Transaction) =>
      activeTransactionIds.has(transaction.id) || activeTransactionIds.has(transaction.transactionId);
    return [...live, ...filtered].filter((transaction) =>
      matchesTransactionFilters(transaction, filters, isLive(transaction), cpoMobileNumbers)
    );
  }, [allTransactions, activeTransactions, activeTransactionIds, datePreset, customFrom, customTo, filters, cpoMobileNumbers]);
  const locationOptions = useMemo(
    () => [...new Set(allTransactions.map((transaction) => transaction.location).filter(Boolean))].sort(),
    [allTransactions]
  );
  const chargerOptions = useMemo(
    () => [...new Set(allTransactions.map(chargerLabel).filter(Boolean))].sort(),
    [allTransactions]
  );
  const filtersActive = Object.values(filters).some((value) => value.trim() !== "");
  const count = transactions.length;
  // Transaction-derived summary metrics from combined CMS + OCPI rows, including
  // active sessions so live consumption is represented too.
  const dashboard = useMemo(
    () => buildLocalDashboard(baseDashboard, transactions),
    [baseDashboard, transactions]
  );

  const pagedTransactions = transactions.slice((page - 1) * pageSize, page * pageSize);

  function exportTransactionsCsv() {
    // Export every row matching the selected table date filter, not only the
    // current pagination page or the visible table columns.
    const headers = CMS_COLUMNS.map((column) => column.label);
    const csvCell = (value: unknown) => {
      // neutralizeCsvCell stops spreadsheet formula injection from customer-controlled text.
      const text = neutralizeCsvCell(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = transactions.map((transaction) =>
      CMS_COLUMN_IDS.map((columnId) =>
        csvCell(transaction[columnId as keyof Transaction])
      )
    );
    const csv = [headers.map(csvCell).join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    link.href = url;
    link.download = `cms-transactions-${datePreset === "custom" ? `${customFrom}_to_${customTo}` : datePreset}-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // Stored sessions stay usable while the live request runs; only an empty screen waits.
  const waiting = loading && allTransactions.length === 0;
  const summary = dashboard?.summary ?? {};
  const details =
    summary.transactionDetails &&
    typeof summary.transactionDetails === "object"
      ? (summary.transactionDetails as Record<string, unknown>)
      : {};
  // From the location list, not the filtered rows, so a quiet day doesn't show 0.
  // Live sessions for the Active now card; a stored copy can carry better energy figures.
  const activeSessions = useMemo(() => {
    const stored = new Map(allTransactions.map((t) => [t.transactionId || t.id, t]));
    return activeTransactions
      .map((t) => {
        const known = stored.get(t.transactionId || t.id);
        return known ? mergeTransactionData(known, t) : t;
      });
  }, [allTransactions, activeTransactions]);
  // Stuck sessions (past 7 hours, or an older duplicate on the same gun) are not counted as charging.
  const { live: liveSessions } = useMemo(() => splitActiveSessions(activeSessions), [activeSessions]);
  const activeCount = activeSessions.length ? liveSessions.length : active;
  const locationCount = Math.max(collectionLength(baseDashboard?.locations), locationOptions.length);

  function selectDatePreset(preset: DatePreset | "custom") {
    setDatePreset(preset);
    setPage(1);
  }

  function updateFilter<K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_TRANSACTION_FILTERS);
    setPage(1);
  }

  function selectPageSize(value: number) {
    setPageSize(value);
    setPage(1);
  }

  const datePresets: Array<{ value: DatePreset | "custom"; label: string }> = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "this-week", label: "This Week" },
    { value: "last-week", label: "Last Week" },
    { value: "this-month", label: "This Month" },
    { value: "last-month", label: "Last Month" },
    { value: "custom", label: "Custom range" },
  ];
  // Match the loaded CMS history window; allow custom filters back to 6 July 2026.
  const customMinDate = "2026-07-06";
  const customMaxDate = istDateString();
  // Month-to-date includes today, so name the range to set it apart from "This month (1–15)".
  const mtdRange = `1–${new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }).format(new Date())}`;
  const filterSelectClass =
    "rounded-lg border border-[#F0F0F0] bg-[#F0F0F0] px-2 py-2 text-xs text-slate-700 outline-none hover:bg-[#e8e8e8]";

  return (
    <>
      <main className="cms-dashboard min-h-screen bg-[#f8f9ff] px-4 pb-12 pt-6 text-[#0b1c30] sm:px-6 sm:pb-16 lg:px-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <section className="relative z-[100] mb-6 overflow-visible rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              CMS Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Operational overview of charging sessions, chargers, locations, energy and revenue from the connected CMS.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {dataTill && (
              <p className="text-xs text-slate-500">
                Data till{" "}
                {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(dataTill))}
              </p>
            )}
            <button
              type="button"
              onClick={() => void startHistoricalBackfill()}
              disabled={backfillRunning}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Activity size={16} className={backfillRunning ? "motion-safe:animate-pulse" : ""} />
              {backfillRunning ? "Backfill running…" : "Start history backfill"}
            </button>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "motion-safe:animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div></section>

        {backfillStatus && (
          <div role="status" aria-live="polite" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {backfillStatus}
          </div>
        )}

        {message && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-sm text-red-700"><span className="font-semibold">Couldn&apos;t load CMS data.</span> {message}</p>
            <button
              onClick={() => void load(true)}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        <div className="relative z-0 mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <SplitCard title="Today" split={todaySplit} />
          {(cycleSplits ?? [{ title: "Current cycle", split: null }, { title: "Previous cycle", split: null }]).map((cycle) => (
            <SplitCard key={cycle.title} title={cycle.title} split={cycle.split} />
          ))}
        </div>

        <div className="relative z-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4">
          <GlassCard className="@container min-w-0 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 @[26rem]:flex-row @[26rem]:items-center">
              <div className="min-w-0 @[26rem]:flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Consumption Details</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 [overflow-wrap:anywhere]">
                  {historicalConsumption?.items[0]
                    ? `${historicalConsumption.items[0].value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh`
                    : "—"}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {historicalConsumption?.items[0]?.label ?? "Loading consumption"}
                </p>
              </div>
              <div className="h-px w-full shrink-0 bg-slate-200 @[26rem]:h-16 @[26rem]:w-px" aria-hidden="true" />
              <div className="min-w-0 space-y-3 @[26rem]:flex-1">
                {(historicalConsumption?.items ?? []).slice(1).map((item) => (
                  <div key={item.label} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="min-w-0 text-xs font-medium text-slate-500">{item.label}</p>
                    <p className="text-sm font-semibold whitespace-nowrap text-slate-800">
                      {item.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
          <LocationsCard
            count={locationCount}
            names={locationOptions}
            live={new Set(liveSessions.map((session) => session.location))}
          />
          <StatusCard count={activeCount} sessions={liveSessions} showLocation={locationCount > 1} onSelect={(s) => setOpenSessionId(s.transactionId || s.id)} />
        </div>

        <GlassCard className="mt-6 overflow-visible rounded-xl border border-slate-200/80 bg-white p-0 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Transactions</h2>
              <p className="text-xs text-slate-500">
                {datePresets.find((preset) => preset.value === datePreset)?.label}
                {filtersActive ? " · filtered" : ""} · {count} matching
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportTransactionsCsv}
                disabled={waiting || transactions.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title={`Export all ${count} transactions matching the selected filters`}
              >
                <Download size={14} />
                Export CSV
              </button>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <span>Date:</span>
                <select
                  value={datePreset}
                  onChange={(event) => selectDatePreset(event.target.value as DatePreset)} disabled={waiting}
                  className="rounded-lg border border-[#F0F0F0] bg-[#F0F0F0] px-2 py-2 text-xs text-slate-700 outline-none hover:bg-[#e8e8e8]"
                  aria-label="Date range"
                >
                  {datePresets.map((preset) => (
                    <option key={preset.value} value={preset.value} className="bg-white">
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              {datePreset === "custom" && (
                <>
                  <input
                    type="date"
                    value={customFrom}
                    min={customMinDate}
                    max={customMaxDate}
                    onChange={(event) => { if (event.target.value) { setCustomFrom(event.target.value); setPage(1); } }}
                    className="rounded-lg border border-[#F0F0F0] bg-[#F0F0F0] px-2 py-2 text-xs text-slate-700 outline-none hover:bg-[#e8e8e8]"
                    aria-label="From date"
                  />
                  <span className="text-xs text-slate-500">to</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customMinDate}
                    max={customMaxDate}
                    onChange={(event) => { if (event.target.value) { setCustomTo(event.target.value); setPage(1); } }}
                    className="rounded-lg border border-[#F0F0F0] bg-[#F0F0F0] px-2 py-2 text-xs text-slate-700 outline-none hover:bg-[#e8e8e8]"
                    aria-label="To date"
                  />
                </>
              )}
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(event) => selectPageSize(Number(event.target.value))} disabled={Boolean(message)}
                  className="rounded-lg border border-[#F0F0F0] bg-[#F0F0F0] px-2 py-2 text-xs text-slate-700 outline-none hover:bg-[#e8e8e8]"
                  aria-label="Transactions per page"
                >
                  <option value={25} className="bg-white">25</option>
                  <option value={50} className="bg-white">50</option>
                  <option value={100} className="bg-white">100</option>
                </select>
              </label>
              <div ref={columnEditorRef} className="relative">
                <button
                  onClick={openColumnEditor}
                  disabled={!columnsLoaded}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#F0F0F0] bg-[#F0F0F0] px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Settings2 size={14} />
                  Columns
                </button>
                {columnEditorOpen && (
                  <div ref={columnMenuRef} className="absolute right-0 top-full z-[9999] mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Columns & fields</p>
                        <p className="text-xs text-slate-500">Add or remove fields from the table, then drag selected fields to set their order.</p>
                      </div>
                      <button onClick={closeColumnEditor} className="rounded-lg p-1 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Close columns">×</button>
                    </div>
                    <div className="mb-3 flex items-center justify-between">
                      <button onClick={() => setDraftColumns(DEFAULT_CMS_COLUMNS)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
                        <RotateCcw size={13} /> Reset
                      </button>
                      <span className="text-xs text-slate-500">{draftColumns.length} of {CMS_COLUMNS.length} selected</span>
                    </div>
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Selected fields · drag to reorder</p>
                        <div className="space-y-1">
                          {draftColumns.map((columnId) => {
                            const column = CMS_COLUMNS.find((item) => item.id === columnId);
                            if (!column) return null;
                            return (
                              <div key={column.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/cms-column", column.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const dragged = event.dataTransfer.getData("text/cms-column") as CmsColumnId; if (dragged) reorderTableColumn(dragged, column.id); }} className="flex cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 active:cursor-grabbing">
                                <input type="checkbox" checked onChange={() => toggleColumn(column.id)} className="h-4 w-4 accent-indigo-600" />
                                <span className="font-mono text-xs text-slate-700">{column.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="border-t border-slate-200 pt-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Available</p>
                        <div className="space-y-1">
                          {CMS_COLUMN_IDS.filter((columnId) => !draftColumns.includes(columnId)).map((columnId) => {
                            const column = CMS_COLUMNS.find((item) => item.id === columnId);
                            if (!column) return null;
                            return (
                              <label key={column.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100">
                                <input type="checkbox" checked={false} onChange={() => toggleColumn(column.id)} className="h-4 w-4 accent-indigo-600" />
                                <span className="font-mono text-xs text-slate-700">{column.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                      <button onClick={closeColumnEditor} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                      <button onClick={() => void saveColumnPreferences(draftColumns)} disabled={savingColumns || draftColumns.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
                        <Save size={13} /> {savingColumns ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="ml-1 flex items-center gap-2 text-xs text-slate-500">
                <Activity size={14} />
                Active: {activeCount}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
            <input
              type="search"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search name, mobile, vehicle, ID"
              className={`${filterSelectClass} w-full sm:w-64`}
              aria-label="Search transactions"
            />
            <select
              value={filters.location}
              onChange={(event) => updateFilter("location", event.target.value)}
              className={filterSelectClass}
              aria-label="Location"
            >
              <option value="" className="bg-white">All locations</option>
              {locationOptions.map((location) => (
                <option key={location} value={location} className="bg-white">{location}</option>
              ))}
            </select>
            <select
              value={filters.charger}
              onChange={(event) => updateFilter("charger", event.target.value)}
              className={filterSelectClass}
              aria-label="Charger"
            >
              <option value="" className="bg-white">All chargers</option>
              {chargerOptions.map((charger) => (
                <option key={charger} value={charger} className="bg-white">{charger}</option>
              ))}
            </select>
            <select
              value={filters.current}
              onChange={(event) => updateFilter("current", event.target.value as TransactionFilters["current"])}
              className={filterSelectClass}
              aria-label="AC or DC"
            >
              <option value="" className="bg-white">AC &amp; DC</option>
              <option value="ac" className="bg-white">AC only</option>
              <option value="dc" className="bg-white">DC only</option>
            </select>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value as TransactionFilters["status"])}
              className={filterSelectClass}
              aria-label="Status"
            >
              <option value="" className="bg-white">All statuses</option>
              <option value="live" className="bg-white">Live</option>
              <option value="completed" className="bg-white">Completed</option>
              <option value="failed" className="bg-white">Failed (0 kWh)</option>
            </select>
            <select
              value={filters.customer}
              onChange={(event) => updateFilter("customer", event.target.value as TransactionFilters["customer"])}
              className={filterSelectClass}
              aria-label="Customer type"
            >
              <option value="" className="bg-white">All customers</option>
              <option value="cpo" className="bg-white">CPO</option>
              <option value="regular" className="bg-white">Regular</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <span>Min kWh:</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={filters.minKwh}
                onChange={(event) => updateFilter("minKwh", event.target.value)}
                placeholder="0"
                className={`${filterSelectClass} w-20`}
                aria-label="Minimum energy in kWh"
              />
            </label>
            {filtersActive && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <RotateCcw size={13} /> Clear filters
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  {visibleColumns.map((columnId) => {
                    const column = CMS_COLUMNS.find((item) => item.id === columnId);
                    if (!column) return null;

                    return (
                      <th
                        key={column.id}
                        draggable
                        onDragStart={(event) => {
                          setDraggedTableColumn(column.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/cms-column", column.id);
                        }}
                        onDragEnd={() => setDraggedTableColumn(null)}
                        onDragOver={(event) => {
                          if (draggedTableColumn && draggedTableColumn !== column.id) {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const dragged =
                            (event.dataTransfer.getData("text/cms-column") as CmsColumnId) ||
                            draggedTableColumn;
                          if (dragged) reorderTableColumn(dragged, column.id);
                          setDraggedTableColumn(null);
                        }}
                        className={[
                          "whitespace-nowrap px-4 py-3 select-none",
                          draggedTableColumn === column.id
                            ? "bg-emerald-300/10 text-emerald-700"
                            : "cursor-grab active:cursor-grabbing",
                        ].join(" ")}
                        title="Drag to reorder column"
                      >
                        {column.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedTransactions.map((transaction) => {
                  const isActive =
                    transaction.stoppedAt == null &&
                    !isStuckSession(transaction) &&
                    (activeTransactionIds.has(transaction.id) ||
                      activeTransactionIds.has(transaction.transactionId));

                  return (
                    <tr key={transaction.id} className={isActive ? "bg-emerald-50 hover:bg-emerald-100/70" : "hover:bg-slate-50"}>
                      {visibleColumns.map((columnId) => (
                        <td key={columnId} className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {columnId === "id" && transaction.id}
                          {columnId === "transactionId" && transaction.transactionId}
                          {columnId === "chargerId" && transaction.chargerId}
                          {columnId === "connectorId" && (transaction.connectorId ?? "—")}
                          {columnId === "startedAt" && formatDate(transaction.startedAt)}
                          {columnId === "stoppedAt" && formatDate(transaction.stoppedAt)}
                          {columnId === "userName" && displayUserName(transaction.userName)}
                          {columnId === "mobile" && (transaction.mobile ?? "—")}
                          {columnId === "userType" && (transaction.userType ?? "—")}
                          {columnId === "tagReference" && (transaction.tagReference ?? "—")}
                          {columnId === "location" && displayLocation(transaction.location)}
                          {columnId === "locationId" && (transaction.locationId ?? "—")}
                          {columnId === "chargerName" && displayCharger(transaction.chargerName)}
                          {columnId === "stationType" && (transaction.stationType ?? "—")}
                          {columnId === "stopReason" && (transaction.stopReason ?? "—")}
                          {columnId === "energyKwh" && (transaction.energyKwh == null ? "—" : `${transaction.energyKwh.toFixed(2)} kWh`)}
                          {columnId === "startSoc" && (transaction.startSoc == null ? "—" : `${transaction.startSoc}%`)}
                          {columnId === "endSoc" && (transaction.endSoc == null ? "—" : `${transaction.endSoc}%`)}
                          {columnId === "vehicleName" && (transaction.vehicleName ?? "—")}
                          {columnId === "vehicleNumber" && <span className="font-mono text-emerald-700">{transaction.vehicleNumber || "—"}</span>}
                          {columnId === "tariffAmount" && (transaction.tariffAmount == null ? "—" : money(transaction.tariffAmount))}
                          {columnId === "vat" && (transaction.vat ?? "—")}
                          {columnId === "invoiceAvailable" && (transaction.invoiceAvailable ? "true" : "false")}
                          {columnId === "userId" && (transaction.userId ?? "—")}
                          {columnId === "vehicleId" && (transaction.vehicleId ?? "—")}
                          {columnId === "geoLatitude" && (transaction.geoLatitude ?? "—")}
                          {columnId === "geoLongitude" && (transaction.geoLongitude ?? "—")}
                          {columnId === "idTag" && (transaction.idTag ?? "—")}
                          {columnId === "isFree" && (transaction.isFree == null ? "—" : transaction.isFree ? "true" : "false")}
                          {columnId === "baseDeductiveAmount" && (transaction.baseDeductiveAmount ?? "—")}
                          {columnId === "isAlphaGuaranteed" && (transaction.isAlphaGuaranteed == null ? "—" : transaction.isAlphaGuaranteed ? "true" : "false")}
                          {columnId === "isTimeBasedTariff" && (transaction.isTimeBasedTariff == null ? "—" : transaction.isTimeBasedTariff ? "true" : "false")}
                          {columnId === "startValue" && (transaction.startValue ?? "—")}
                          {columnId === "stopValue" && (transaction.stopValue ?? "—")}
                          {columnId === "createdAt" && formatDate(transaction.createdAt)}
                          {columnId === "updatedAt" && formatDate(transaction.updatedAt)}
                          {columnId === visibleColumns[0] && isActive && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              <span className="h-1.5 w-1.5 motion-safe:animate-pulse rounded-full bg-emerald-300" />Active
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {!loading && transactions.length === 0 && (
                  <tr><td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-slate-500">
                    {filtersActive ? (
                      <>
                        No transactions match these filters.{" "}
                        <button onClick={clearFilters} className="font-semibold text-violet-700 hover:text-violet-900">Clear filters</button>
                      </>
                    ) : (
                      "No transactions in this date range."
                    )}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4">
            <span className="text-xs text-slate-500">
              Page {page} of {Math.max(1, Math.ceil(count / pageSize))}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || waiting}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={page >= Math.max(1, Math.ceil(count / pageSize)) || waiting}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </main>
    {(() => {
      const open = openSessionId ? liveSessions.find((s) => (s.transactionId || s.id) === openSessionId) : null;
      return open ? <SessionDetails session={open} onClose={() => setOpenSessionId(null)} /> : null;
    })()}
    </>
  );
}

const ACTIVE_LIST_LIMIT = 4;

// Charging state and the sessions charging now. ChargeMOD's stuck sessions (past 7 hours, or
// an older duplicate on a gun) are already filtered out by splitActiveSessions.
function StatusCard({ count, sessions, showLocation, onSelect }: { count: number; sessions: Transaction[]; showLocation: boolean; onSelect: (session: Transaction) => void }) {
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  const dateTime = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const today = istDateString();
  // Time only for today's sessions; older ones get the date so 23:48 isn't read as later today.
  const started = (value: string) =>
    istDateString(new Date(value)) === today ? time.format(new Date(value)) : dateTime.format(new Date(value));
  const charging = count > 0;
  const shown = sessions.slice(0, ACTIVE_LIST_LIMIT);
  return (
    <GlassCard className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              charging ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${charging ? "bg-emerald-500 motion-safe:animate-pulse" : "border border-slate-400"}`}
              aria-hidden="true"
            />
            {charging ? "Charging" : "Idle"}
          </span>
          <p className={`text-2xl font-bold tracking-tight ${charging ? "text-emerald-600" : "text-slate-900"}`} aria-label={`${count} charging now`}>
            {count}
          </p>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{charging ? "Loading sessions…" : "No sessions charging"}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {shown.map((session) => (
            <li key={session.transactionId || session.id}>
              <button
                type="button"
                onClick={() => onSelect(session)}
                title="Show live details"
                className="group -mx-1.5 flex w-[calc(100%+0.75rem)] cursor-pointer items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-left hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-violet-600"
              >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                {shortChargerLabel(session.chargerName, session.stationType, session.connectorId)}
                {showLocation && session.location && (
                  <span className="font-normal text-slate-400"> · {displayLocation(session.location)}</span>
                )}
              </span>
              <span className="whitespace-nowrap text-slate-500">
                {session.energyKwh == null ? "—" : formatKwh(session.energyKwh)}
                {session.startedAt ? ` · ${started(session.startedAt)}` : ""}
              </span>
              <span className="text-sm leading-none text-slate-400 group-hover:text-violet-600" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
          {sessions.length > ACTIVE_LIST_LIMIT && (
            <li className="text-slate-500">+{sessions.length - ACTIVE_LIST_LIMIT} more</li>
          )}
          <li className="pt-1 text-[11px] text-slate-400">Tap a session for live SoC and time left</li>
        </ul>
      )}
    </GlassCard>
  );
}

// Site names from ChargeMOD, shortened like the table's Location column; green when a car is charging there.
function LocationsCard({ count, names, live }: { count: number; names: string[]; live: Set<string> }) {
  return (
    <GlassCard className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Locations</p>
        <p className="text-sm font-semibold text-slate-500">{count}</p>
      </div>
      {names.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">—</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {names.map((name) => (
            <li key={name} className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${live.has(name) ? "bg-emerald-500" : "bg-slate-300"}`}
                aria-label={live.has(name) ? "Charging now" : "Idle"}
              />
              <span className="min-w-0 truncate" title={name}>{displayLocation(name)}</span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <GlassCard className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight [overflow-wrap:anywhere] ${accent ? "text-emerald-600" : "text-slate-900"}`}>{value}</p>
    </GlassCard>
  );
}
function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
