"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCw, Settings2, RotateCcw, Save } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import AdminHeader from "@/components/admin/AdminHeader";

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
  userType: string | null;
  tagReference: string | null;
  location: string;
  locationId: number | null;
  chargerName: string;
  stationType: string | null;
  stopReason: string | null;
  energyKwh: number | null;
  startSoc: number | null;
  endSoc: number | null;
  vehicleName: string | null;
  vehicleNumber: string | null;
  tariffAmount: number | null;
  vat: number | null;
  invoiceAvailable: boolean;
  userId: string | null;
  vehicleId: string | null;
  geoLatitude: number | null;
  geoLongitude: number | null;
  idTag: string | null;
  isFree: boolean | null;
  baseDeductiveAmount: number | null;
  isAlphaGuaranteed: boolean | null;
  isTimeBasedTariff: boolean | null;
  startValue: number | null;
  stopValue: number | null;
  createdAt: string | null;
  updatedAt: string | null;
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

type DatePreset =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month";

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

// CMS UI deployment: column visibility, field adding, and drag-and-drop ordering remain supported; runtime data logic unchanged.
export default function CmsOperatorDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [active, setActive] = useState(0);
  const [activeTransactionIds, setActiveTransactionIds] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<CmsColumnId[]>(DEFAULT_CMS_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<CmsColumnId[]>(DEFAULT_CMS_COLUMNS);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [savingColumns, setSavingColumns] = useState(false);
  const [columnsLoaded, setColumnsLoaded] = useState(false);
  const columnEditorRef = useRef<HTMLDivElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [draggedTableColumn, setDraggedTableColumn] = useState<CmsColumnId | null>(null);



  useEffect(() => {
    let cancelled = false;

    async function loadColumnPreferences() {
      try {
        const response = await fetch("/api/admin/preferences", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { columns?: unknown };
        if (cancelled || !Array.isArray(data.columns)) return;

        const valid = data.columns.filter(
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

  const pagedTransactions = transactions.slice((page - 1) * pageSize, page * pageSize);

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

  function selectPageSize(value: number) {
    setPageSize(value);
    setPage(1);
  }

  const datePresets: Array<{ value: DatePreset; label: string }> = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "this-week", label: "This Week" },
    { value: "last-week", label: "Last Week" },
    { value: "this-month", label: "This Month" },
  ];

  return (
    <>
      <AdminHeader />
      <main className="min-h-screen bg-[#f8f9ff] px-4 pb-12 pt-6 text-[#0b1c30] sm:px-6 sm:pb-16 lg:px-8">
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void load(true)}
              disabled={loading || Boolean(message)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div></section>


        {message && (
          <GlassCard className="mt-6 border-red-400/20 p-5">
            <p className="text-sm text-red-200">{message}</p>
          </GlassCard>
        )}

        <div className="relative z-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <GlassCard className="mt-6 overflow-visible rounded-xl border border-slate-200/80 bg-white p-0 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Transactions</h2>
              <p className="text-xs text-slate-500">
                {datePresets.find((preset) => preset.value === datePreset)?.label} · {count} matching
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <span>Date:</span>
                <select
                  value={datePreset}
                  onChange={(event) => selectDatePreset(event.target.value as DatePreset)} disabled={Boolean(message)}
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
                  disabled={!columnsLoaded || Boolean(message)}
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
                Active: {active}
              </div>
            </div>
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
                          {columnId === "tariffAmount" && (transaction.tariffAmount ?? "—")}
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
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />Active
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {!loading && transactions.length === 0 && (
                  <tr><td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-slate-400">No transactions returned for the current period.</td></tr>
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
                disabled={page <= 1 || loading || Boolean(message)}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={page >= Math.max(1, Math.ceil(count / pageSize)) || loading || Boolean(message)}
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
    </>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <GlassCard className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${accent ? "text-emerald-600" : "text-slate-900"}`}>{value}</p>
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
