"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, RefreshCw } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

type Dashboard = {
  summary: Record<string, unknown>;
  chart: Record<string, unknown>;
  chargers: Record<string, unknown>;
  locations: Record<string, unknown>;
};

type Transaction = {
  id: string;
  transactionId: string;
  chargerId: string;
  connectorId: number | null;
  startedAt: string | null;
  stoppedAt: string | null;
  userName: string;
  mobile: string | null;
  location: string;
  chargerName: string;
  stationType: string | null;
  stopReason: string | null;
  energyKwh: number | null;
  startSoc: number | null;
  endSoc: number | null;
  tariffAmount: number | null;
  vehicleNumber: string | null;
};

type TransactionResponse = {
  transactions?: Transaction[];
  count?: number;
};

type ActiveTransactionResponse = {
  transactions?: Transaction[];
  count?: number;
};

type CmsCache = {
  transactions: Transaction[];
  coverage: Array<{ startDate: string; endDate: string }>;
};

const CMS_CACHE_KEY = "triarc-cms-transaction-cache";

function readCmsCache(): CmsCache {
  if (typeof window === "undefined") return { transactions: [], coverage: [] };
  try {
    const raw = window.sessionStorage.getItem(CMS_CACHE_KEY);
    if (!raw) return { transactions: [], coverage: [] };
    const parsed = JSON.parse(raw) as Partial<CmsCache>;
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      coverage: Array.isArray(parsed.coverage) ? parsed.coverage : [],
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

function mergeCmsTransactions(existing: Transaction[], incoming: Transaction[]) {
  const merged = new Map<string, Transaction>();
  for (const transaction of [...existing, ...incoming]) {
    const key = transaction.id || transaction.transactionId;
    if (key) merged.set(key, transaction);
  }
  return Array.from(merged.values());
}

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
    return start <= requestedStart && end >= requestedEnd;
  });
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
  }).format(num(value) / 1000);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type DatePreset =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month";

function getISTCalendarDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(
    `${values.year}-${values.month}-${values.day}T00:00:00+05:30`
  );
}

function getDateRangeIST(preset: DatePreset) {
  const today = getISTCalendarDate();
  const day = 24 * 60 * 60 * 1000;
  const startOfWeek = new Date(today.getTime() - ((today.getDay() + 6) % 7) * day);
  const startOfLastWeek = new Date(startOfWeek.getTime() - 7 * day);
  const startOfMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1) - 330 * 60 * 1000
  );
  const startOfLastMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1) - 330 * 60 * 1000
  );

  switch (preset) {
    case "yesterday":
      return {
        startDate: new Date(today.getTime() - day).toISOString(),
        endDate: today.toISOString(),
      };
    case "this-week":
      return {
        startDate: startOfWeek.toISOString(),
        endDate: new Date(today.getTime() + day).toISOString(),
      };
    case "last-week":
      return {
        startDate: startOfLastWeek.toISOString(),
        endDate: startOfWeek.toISOString(),
      };
    case "this-month":
      return {
        startDate: startOfMonth.toISOString(),
        endDate: new Date(today.getTime() + day).toISOString(),
      };
    case "last-month":
      return {
        startDate: startOfLastMonth.toISOString(),
        endDate: startOfMonth.toISOString(),
      };
    case "today":
    default:
      return {
        startDate: today.toISOString(),
        endDate: new Date().toISOString(),
      };
  }
}

function buildLocalDashboard(base: Dashboard | null, transactions: Transaction[]): Dashboard | null {
  if (!base) return null;

  const chargers = new Set(
    transactions.map((transaction) => transaction.chargerId).filter(Boolean)
  );
  const locations = new Set(
    transactions.map((transaction) => transaction.location).filter(Boolean)
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
    locations: {
      ...(base.locations && typeof base.locations === "object"
        ? base.locations
        : {}),
      localCount: locations.size,
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

export default function CmsOperatorDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [active, setActive] = useState(0);
  const [activeTransactionIds, setActiveTransactionIds] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setMessage("");

    try {
      const dateRange = getDateRangeIST(datePreset);
      let cache = readCmsCache();

      if (forceRefresh) {
        cache = { transactions: [], coverage: [] };
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(CMS_CACHE_KEY);
        }
      }

      let filteredTransactions: Transaction[];
      let dashboardData: Dashboard | undefined;
      let activeData: ActiveTransactionResponse = {};

      if (rangeIsCovered(cache.coverage, dateRange.startDate, dateRange.endDate)) {
        filteredTransactions = filterTransactionsByRange(
          cache.transactions,
          dateRange.startDate,
          dateRange.endDate
        );
      } else {
        const params = new URLSearchParams({
          page: "1",
          perPage: "25",
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });

        const response = await fetch(
          `/api/cms/operator?${params.toString()}`,
          { cache: "no-store" }
        );

        const data = (await response.json()) as {
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

        dashboardData = data.dashboard;
        if (!dashboardData) {
          throw new Error(data.error ?? "CMS dashboard data was not returned.");
        }

        const incoming = data.transactions?.transactions ?? [];
        const coverage = data.transactions?.coverage ?? dateRange;

        cache = {
          transactions: mergeCmsTransactions(cache.transactions, incoming),
          coverage: [...cache.coverage, coverage],
        };
        writeCmsCache(cache);

        filteredTransactions = filterTransactionsByRange(
          cache.transactions,
          dateRange.startDate,
          dateRange.endDate
        );
        activeData = data.active ?? {};
      }

      const activeWasFetched =
        activeData.transactions !== undefined || activeData.count !== undefined;
      const currentActiveTransactions = activeData.transactions ?? [];
      const liveTransactions = currentActiveTransactions.filter(
        (activeTransaction) =>
          !filteredTransactions.some(
            (transaction) =>
              transaction.id === activeTransaction.id ||
              transaction.transactionId === activeTransaction.transactionId
          )
      );

      const visibleTransactions = [...liveTransactions, ...filteredTransactions];
      const nextDashboard = dashboardData
        ? dashboardData
        : buildLocalDashboard(dashboard, filteredTransactions);

      if (nextDashboard) setDashboard(nextDashboard);
      setTransactions(visibleTransactions);
      setCount(filteredTransactions.length + liveTransactions.length);

      if (activeWasFetched) {
        setActive(activeData.count ?? currentActiveTransactions.length);
        setActiveTransactionIds(
          new Set(
            currentActiveTransactions.flatMap((transaction) =>
              [transaction.id, transaction.transactionId].filter(Boolean)
            )
          )
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CMS request failed.");
    } finally {
      setLoading(false);
    }
  }, [datePreset]);

  useEffect(() => {
    void load();
  }, [load]);

  const pagedTransactions = transactions.slice((page - 1) * 25, page * 25);

  const summary = dashboard?.summary ?? {};
  const details =
    summary.transactionDetails &&
    typeof summary.transactionDetails === "object"
      ? (summary.transactionDetails as Record<string, unknown>)
      : {};
  const locationCount =
    typeof (dashboard?.locations as Record<string, unknown> | undefined)?.localCount === "number"
      ? Number((dashboard?.locations as Record<string, unknown>).localCount)
      : collectionLength(dashboard?.locations);

  function selectDatePreset(preset: DatePreset) {
    setDatePreset(preset);
    setPage(1);
  }

  const datePresets: Array<{ value: DatePreset; label: string }> = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "this-week", label: "This Week" },
    { value: "last-week", label: "Last Week" },
    { value: "this-month", label: "This Month" },
    { value: "last-month", label: "Last Month" },
  ];

  return (
    <main className="min-h-screen bg-[#03110d] px-6 py-12 text-white sm:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200"
            >
              <ArrowLeft size={16} /> Admin
            </Link>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              CMS Operator Dashboard
            </h1>
            <p className="mt-2 text-sm text-white/60">
              ChargeMOD Power Line operational data, proxied securely through TriArc.
            </p>
          </div>
          <button
            onClick={() => void load(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {message && (
          <GlassCard className="mt-6 border-red-400/20 p-5">
            <p className="text-sm text-red-200">{message}</p>
          </GlassCard>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Transactions" value={String(summary.transactionCount ?? 0)} />
          <Metric label="Chargers" value={String(summary.chargerCount ?? 0)} />
          <Metric label="Locations" value={String(locationCount)} />
          <Metric label="Active now" value={String(active)} accent />
          <Metric
            label="Total energy"
            value={`${(num(details.totalEnergy) / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} kWh`}
          />
          <Metric label="Total revenue" value={money(details.totalRevenue)} />
          <Metric
            label="Total duration"
            value={formatDuration(num(details.totalTime))}
          />
          <Metric
            label="Live state"
            value={active > 0 ? "Charging" : "Idle"}
            accent={active > 0}
          />
        </div>

        <GlassCard className="mt-6 overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="font-bold">Transactions</h2>
              <p className="text-xs text-white/50">
                {datePresets.find((preset) => preset.value === datePreset)?.label} · {count} matching
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {datePresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => selectDatePreset(preset.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                    datePreset === preset.value
                      ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200"
                      : "border-white/10 text-white/60 hover:bg-white/5"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <div className="ml-1 flex items-center gap-2 text-xs text-white/50">
                <Activity size={14} />
                Active: {active}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3">Vehicle Number</th>
                   <th className="px-4 py-3">Start SoC</th>
                   <th className="px-4 py-3">End SoC</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Charger</th>
                  <th className="px-4 py-3">Energy</th>
                  <th className="px-4 py-3">Stop reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pagedTransactions.map((transaction) => {
                  const isActive =
                    transaction.stoppedAt == null &&
                    (activeTransactionIds.has(transaction.id) ||
                      activeTransactionIds.has(transaction.transactionId));

                  return (
                    <tr
                      key={transaction.id}
                      className={
                        isActive
                          ? "bg-emerald-400/10 ring-1 ring-inset ring-emerald-300/30 hover:bg-emerald-400/15"
                          : "hover:bg-white/[0.02]"
                      }
                    >
                      <td className="px-4 py-3 font-mono text-xs text-emerald-200">
                        {transaction.vehicleNumber || "—"}
                        {isActive && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                            Active
                          </span>
                        )}
                      </td>
                       <td className="px-4 py-3">{transaction.startSoc == null ? "—" : `${transaction.startSoc}%`}</td>
                       <td className="px-4 py-3">{transaction.endSoc == null ? "—" : `${transaction.endSoc}%`}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-white/70">
                        {formatDate(transaction.startedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div>{displayUserName(transaction.userName)}</div>
                        {transaction.mobile && (
                          <div className="text-xs text-white/40">{transaction.mobile}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {displayLocation(transaction.location)}
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {displayCharger(transaction.chargerName)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {transaction.energyKwh == null
                          ? "—"
                          : `${transaction.energyKwh.toFixed(2)} kWh`}
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        {transaction.stopReason ?? "—"}
                      </td>
                    </tr>
                  );
                })}
                {!loading && transactions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-white/40">
                      No transactions returned for the current period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
            <span className="text-xs text-white/50">
              Page {page} of {Math.max(1, Math.ceil(count / 25))}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={page >= Math.max(1, Math.ceil(count / 25)) || loading}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <GlassCard className="p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent ? "text-emerald-300" : "text-white"}`}>
        {value}
      </p>
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
