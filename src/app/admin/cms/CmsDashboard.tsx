"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDown, ArrowUp, ChevronsUpDown, RefreshCw, Search, Settings2, SlidersHorizontal, RotateCcw, Save, Download, X } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { Loader } from "@/components/ui/Loader";
import { Spoiler } from "@/components/ui/Spoiler";
import { getCmsWindowSnapshot, requestCmsWindow, subscribeCmsWindow, type CmsWindowSnapshot } from "./cmsWindowStore";
import { type DatePreset, getCustomRangeIST, getDateRangeIST, istDateString } from "./dateRanges";
import {
  CMS_COLUMN_IDS,
  type CmsColumnId,
  displayLocation,
  EMPTY_TRANSACTION_FILTERS,
  type TransactionFilters,
  chargerLabel,
  matchesTransactionFilters,
  shortChargerLabel,
  splitActiveSessions,
  isStuckSession,
} from "./transactionFilters";
import { neutralizeCsvCell } from "@/lib/security";
import { cycleLabel, cyclesBack, previousBillingCycle } from "@/lib/billingCycle";
import { ConsumptionCard, type PlatformMetrics } from "./cmsConsumptionCard";
import { cycleRuleFor } from "@/lib/cms/providers";
import type { CmsCache, Dashboard, Transaction } from "./cmsCache";
import { fetchColumnPreferences, mergeTransactionData, rememberColumnPreferences } from "./cmsCache";
import { displaySessionId, providerLabel } from "@/lib/cms/providerIds";
import { matchCpoMobiles } from "./cpoNumbersCache";
import { CellPopover, DetailRow } from "./CellPopover";
import { useLiveMetrics, withLiveValues } from "./useLiveMetrics";
import { StationSelect, useStationSelection } from "./stationSelection";
import { PlatformSelect, usePlatformSelection } from "./platformSelection";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import {
  filterTransactionsByRange,
  money,
  formatDate,
  CMS_COLUMN_LABELS,
  CMS_COLUMNS,
  DEFAULT_CMS_COLUMNS,
  DEFAULT_TABLE_SORT,
  compareTransactions,
  socRange,
  collectionLength,
  displayUserName,
  displayChargerWithGun,
  splitPeriod,
  formatKwh,
} from "./cmsHelpers";
import { useSessionsTableState } from "./useSessionsTableState";
import { PeriodMatrixCard, type MatrixPeriod } from "./cmsMatrixCard";
import { StatusCard, type ConnectorState } from "./cmsStatusCard";


// One platform's figures: its columns of the matrix, and its older cycles under it.

export default function CmsOperatorDashboard() {
  const { isPartner } = useAdminModule(); // backfill is full access only (investors are read-only)
  const [baseDashboard, setBaseDashboard] = useState<Dashboard | null>(null);
  // Status is capped to the matrix/Consumption pair's height on a wide screen, so a long
  // session detail scrolls inside the card rather than stretching the row.
  const pairRef = useRef<HTMLDivElement>(null);
  const [pairHeight, setPairHeight] = useState<number | null>(null);
  useEffect(() => {
    const pair = pairRef.current;
    if (!pair || typeof ResizeObserver === "undefined") return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const apply = () => setPairHeight(wide.matches ? pair.offsetHeight : null);
    const watch = new ResizeObserver(apply);
    watch.observe(pair);
    wide.addEventListener("change", apply);
    apply();
    return () => {
      watch.disconnect();
      wide.removeEventListener("change", apply);
    };
  }, []);
  // One entry per platform the selector shows: null until the first load finishes.
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetrics[] | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [activeTransactions, setActiveTransactions] = useState<Transaction[]>([]);
  const [active, setActive] = useState(0);
  const [activeTransactionIds, setActiveTransactionIds] = useState<Set<string>>(new Set());
  const { page, setPage, pageSize, setPageSize, sort, setSort, datePreset, setDatePreset, customFrom, setCustomFrom, customTo, setCustomTo, filters, setFilters, visibleColumns, setVisibleColumns, draftColumns, setDraftColumns, columnEditorOpen, setColumnEditorOpen, savingColumns, setSavingColumns, columnsLoaded, setColumnsLoaded, filterMenuOpen, setFilterMenuOpen, filterMenuRef, columnEditorRef, columnMenuRef, draggedTableColumn, setDraggedTableColumn } = useSessionsTableState();
  const [cpoMobileNumbers, setCpoMobileNumbers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState("");
  const [dataTill, setDataTill] = useState<string | null>(null);



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
  }, [setColumnsLoaded, setDraftColumns, setVisibleColumns]);

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
      rememberColumnPreferences(columns);
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
    if (!filterMenuOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) setFilterMenuOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [filterMenuOpen, filterMenuRef, setFilterMenuOpen]);

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
        setDraftColumns(visibleColumns);
        setColumnEditorOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [columnEditorOpen, visibleColumns, columnEditorRef, columnMenuRef, setColumnEditorOpen, setDraftColumns]);

  // The CMS window is loaded through cmsWindowStore, shared with Overview: a Refresh
  // started on either page is one request, and both pages follow it.
  // The cards belong to the platforms the selector shows, each on its own billing cycle; see
  // ./platformSelection.
  const applyCache = useCallback(async (cache: CmsCache, shown: readonly string[]) => {
    try {
      // Fetch one consistent transaction window for all dashboard metrics and the
      // table; the table's date filter is applied client-side and never refetches. It covers the previous
      // calendar month and the current month-to-date.
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
        // Every platform shown keeps its own figures: they bill on different cycles, so a total
        // summed across two of them would match no bill.
        const allMetricTransactions = Array.from(metricMap.values());
        const cpoMobileNumbers = await matchCpoMobiles(
          allMetricTransactions.filter((transaction) => !transaction.type?.trim()).map((transaction) => transaction.mobile)
        );
        setCpoMobileNumbers(cpoMobileNumbers);
        const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
        // `end` is exclusive, so the cycle's last day is the day before it.
        const lastDay = (end: number) => dayFmt.format(new Date(end - 24 * 60 * 60 * 1000));
        const iso = (ms: number) => new Date(ms).toISOString();
        // An empty selection is the first load, before the platforms are known: everything
        // counts, on the default cycle.
        const groups: Array<string | null> = shown.length ? [...shown] : [null];
        setPlatformMetrics(groups.map((provider) => {
          const transactions = provider
            ? allMetricTransactions.filter((transaction) => transaction.provider === provider)
            : allMetricTransactions;
          // Seven cycles from the one definition in @/lib/billingCycle: the matrix shows the
          // current one and the one before, Consumption Details the five older ones.
          const rule = cycleRuleFor(provider);
          const cycleWindow = cyclesBack(now, 7, rule);
          return {
            provider: provider ?? "",
            today: splitPeriod(filterTransactionsByRange(transactions, todayRange.startDate, todayRange.endDate), cpoMobileNumbers),
            cycles: cycleWindow.slice(-2).reverse().map((cycle, index) => ({
              dates: `${dayFmt.format(new Date(cycle.start))} – ${lastDay(cycle.end)}`,
              split: splitPeriod(
                // The current cycle has not finished, so it only counts up to now.
                filterTransactionsByRange(transactions, iso(cycle.start), iso(index === 0 ? Math.min(cycle.end, now.getTime()) : cycle.end)),
                cpoMobileNumbers
              ),
            })),
            // Consumption Details carries on where the matrix stops, newest first.
            earlier: cycleWindow.slice(0, 5).reverse().map((cycle) => {
              const split = splitPeriod(filterTransactionsByRange(transactions, iso(cycle.start), iso(cycle.end)), cpoMobileNumbers);
              return { label: cycleLabel(cycle, rule), energy: split.energy.total, revenue: split.revenue.total };
            }),
          };
        }));
      } catch {
        // Metric calculation must not prevent the dashboard from rendering.
      }
      };

      await apply(cache);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CMS request failed.");
    }
  }, []);

  // The station selector narrows every card and the table; a new choice re-applies the loaded
  // window (this effect re-runs) without fetching again.
  const { options: stationOptions, stationId, setStation, filterCache } = useStationSelection();
  // Derived from the unfiltered cache, so choosing a platform never narrows what is on offer.
  const [livePlatforms, setLivePlatforms] = useState<string[]>([]);
  // This page can draw platforms side by side, so it offers "All platforms".
  const { options: platformOptions, selection, shown: shownPlatforms, setPlatform } = usePlatformSelection(livePlatforms, { allowAll: true });
  const windowRequested = useRef(false);
  useEffect(() => {
    let shownCache: CmsCache | null = null;
    const sync = ({ cache, refreshing, error }: CmsWindowSnapshot) => {
      // Stored rows are enough to render immediately; live CMS sync continues in the background.
      // Reflect the shared refresh state even when cached rows remain visible.
      // This keeps the Refresh button disabled/spinning consistently with Overview.
      setLoading(refreshing);
      setMessage(error ?? "");
      if (cache && cache !== shownCache) {
        shownCache = cache;
        setDataTill(cache.coverage.at(-1)?.endDate ?? null);
        setLivePlatforms([...new Set(cache.transactions.map((t) => t.provider).filter((id): id is string => !!id))].sort());
        void applyCache(filterCache(cache), shownPlatforms);
      }
    };
    sync(getCmsWindowSnapshot());
    const unsubscribe = subscribeCmsWindow(sync);
    if (!windowRequested.current) {
      windowRequested.current = true;
      void requestCmsWindow();
    }
    return unsubscribe;
  }, [applyCache, filterCache, shownPlatforms]);

  const load = useCallback((forceRefresh = false) => requestCmsWindow(forceRefresh), []);

  const startHistoricalBackfill = useCallback(async () => {
    if (backfillRunning) return;
    // One fixed window, the previous billing cycle, for both stages and every batch of this run.
    const { from, to } = previousBillingCycle();
    const day = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
    const cycle = `${day.format(new Date(from))} – ${day.format(new Date(Date.parse(to) - 1))}`;
    const confirmed = window.confirm(
      `Start history backfill for the previous billing cycle (${cycle})? This saves every ChargeMOD session in it, then fetches their meter readings in batches. It may take several minutes.`
    );
    if (!confirmed) return;

    setBackfillRunning(true);
    setBackfillStatus(`Fetching sessions for ${cycle}…`);
    const post = async (body: Record<string, unknown>) => {
      const response = await fetch("/api/cms/live/backfill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ from, to, ...body }),
      });
      return { response, result: await response.json().catch(() => ({})) };
    };
    let totalSucceeded = 0;
    let totalFailed = 0;
    const failedIds = new Set<string>();
    let sourceWarning = "";
    try {
      const sync = await post({ stage: "transactions" });
      const synced = sync.result as {
        retrieved?: Record<string, number>; // sessions per platform
        sessions?: number;
        synced?: number;
        sourceErrors?: string[];
        error?: string;
      };
      if (!sync.response.ok) {
        throw new Error(`${synced.error || `Session sync failed (HTTP ${sync.response.status})`}. Meter readings were not fetched.`);
      }
      if (synced.sourceErrors?.length) {
        console.warn("Backfill source errors:", synced.sourceErrors);
        sourceWarning = ` · some sources failed (${synced.sourceErrors.join("; ")}), so their sessions may be missing; run it again later`;
      }
      const perPlatform = Object.entries(synced.retrieved ?? {}).map(([label, n]) => `${label} ${n}`).join(", ");
      const sessionsLine = `${(synced.synced ?? 0).toLocaleString()} sessions saved${perPlatform ? ` (${perPlatform})` : ""}`;
      setBackfillStatus(`${sessionsLine}${sourceWarning} · fetching meter readings…`);

      for (let batch = 1; batch <= 30; batch += 1) {
        const { response, result: raw } = await post({ stage: "meters", limit: 10, exclude: [...failedIds] });
        const result = raw as {
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
          throw new Error(`${sessionsLine}, but meter readings stopped: ${result.error || `HTTP ${response.status}`}`);
        }

        totalSucceeded += result.succeeded ?? 0;
        totalFailed += result.failed ?? 0;
        for (const failure of result.failures ?? []) failedIds.add(failure.transactionId);
        if (result.failures?.length) {
          console.warn(`Batch ${batch} meter-reading failures:`);
          console.table(result.failures);
        }
        const meters = `meter readings: ${totalSucceeded.toLocaleString()} saved · ${totalFailed} failed · ${(result.remaining ?? "unknown").toLocaleString()} remaining`;
        setBackfillStatus(`${sessionsLine}${sourceWarning} · ${meters}`);

        if (result.rateLimited) {
          setBackfillStatus(`Paused by ChargeMOD rate limit · ${sessionsLine}${sourceWarning} · ${meters}. Wait a few minutes, then click again to continue.`);
          return;
        }
        // remaining counts failed sessions too, so complete means every one was saved.
        if (result.complete) {
          setBackfillStatus(sourceWarning
            ? `Meter readings done, but not complete · ${sessionsLine}${sourceWarning} · ${meters}`
            : `Backfill complete · ${sessionsLine} · ${meters}`);
          return;
        }
        // Nothing left to try in this run except sessions that already failed.
        if (!result.requested) {
          setBackfillStatus(`Not complete · ${sessionsLine}${sourceWarning} · ${meters}. Click again to retry the failed sessions.`);
          return;
        }
      }
      setBackfillStatus(`Paused after 300 sessions · ${sessionsLine}${sourceWarning} · meter readings: ${totalSucceeded} saved · ${totalFailed} failed. Click again to continue.`);
    } catch (error) {
      console.error("Historical backfill stopped due to an error.", error);
      setBackfillStatus(error instanceof Error ? `Backfill stopped: ${error.message}` : "Backfill stopped due to an unknown error.");
    } finally {
      setBackfillRunning(false);
    }
  }, [backfillRunning]);

  // The table and the Status card follow the platform selector, so neither keeps a platform
  // filter of its own. An empty selection is the first load, before the platforms are known.
  const onShownPlatform = useCallback(
    (transaction: Transaction) => shownPlatforms.length === 0 || shownPlatforms.includes(transaction.provider ?? ""),
    [shownPlatforms]
  );
  // Live sessions for the Active now card; a stored copy can carry better energy figures.
  const activeSessions = useMemo(() => {
    const stored = new Map(allTransactions.map((t) => [t.transactionId || t.id, t]));
    return activeTransactions
      .filter(onShownPlatform)
      .map((t) => {
        const known = stored.get(t.transactionId || t.id);
        return known ? mergeTransactionData(known, t) : t;
      });
  }, [allTransactions, activeTransactions, onShownPlatform]);
  // Stuck sessions (past 7 hours, or an older duplicate on the same gun) are not counted as charging.
  const { live: liveSessions } = useMemo(() => splitActiveSessions(activeSessions), [activeSessions]);
  // Live meter readings for every charging session; the Status list shows their Energy.
  const liveById = useLiveMetrics(liveSessions.map((s) => s.transactionId || s.id));
  const liveShown = useMemo(() => liveSessions.map((s) => withLiveValues(s, liveById[s.transactionId || s.id])), [liveSessions, liveById]);
  // Every gun that ran a session in the last 30 days on the shown platforms, with the ones a
  // live session is on marked. The CMS reports nothing about an idle gun, so this is the only
  // honest way to list them — and "Idle" can only mean no session is running, never that the
  // gun is healthy.
  const connectors = useMemo(() => {
    const gunKey = (t: Transaction) => `${t.provider ?? ""}|${t.chargerName ?? ""}|${t.connectorId ?? ""}`;
    const guns = new Map<string, { gun: ConnectorState; at: number }>();
    let newest = 0;
    for (const transaction of allTransactions) {
      if (!onShownPlatform(transaction)) continue;
      const at = transaction.startedAt ? new Date(transaction.startedAt).getTime() : NaN;
      if (!Number.isFinite(at)) continue;
      if (at > newest) newest = at;
      const key = gunKey(transaction);
      const known = guns.get(key);
      // The newest session names the gun, so a renamed charger shows its current name.
      if (known && known.at >= at) continue;
      guns.set(key, {
        at,
        gun: {
          id: key,
          label: shortChargerLabel(transaction.chargerName, transaction.stationType, transaction.connectorId),
          location: transaction.location ?? null,
          provider: transaction.provider,
          charging: false,
        },
      });
    }
    // Thirty days back from the newest session in the window rather than from the clock, so
    // the list is the same on every render and a gun that stopped being used drops off.
    const since = newest - 30 * 24 * 60 * 60 * 1000;
    const busy = new Set(liveShown.map(gunKey));
    return Array.from(guns.values())
      .filter((entry) => entry.at >= since)
      .sort((a, b) => a.gun.label.localeCompare(b.gun.label))
      .map((entry) => ({ ...entry.gun, charging: busy.has(entry.gun.id) }));
  }, [allTransactions, onShownPlatform, liveShown]);
  const transactions = useMemo(() => {
    const dateRange =
      datePreset === "custom" ? getCustomRangeIST(customFrom, customTo) : getDateRangeIST(datePreset);
    const filtered = filterTransactionsByRange(allTransactions, dateRange.startDate, dateRange.endDate);

    // Treat the live-active endpoint as authoritative when a stored row has the same ID.
    // Also use stored open rows as a fallback if the active endpoint temporarily omits one.
    const openStoredTransactions = allTransactions.filter(
      (transaction) => transaction.stoppedAt == null && !isStuckSession(transaction)
    );
    const uniqueLive = new Map<string, Transaction>();
    for (const transaction of [...openStoredTransactions, ...activeTransactions]) {
      const key = transaction.transactionId || transaction.id;
      if (!key) continue;
      const existing = uniqueLive.get(key);
      uniqueLive.set(key, existing ? mergeTransactionData(existing, transaction) : transaction);
    }

    // Charging sessions show their live meter Energy/SoC, the same figures as the Status list.
    const live = Array.from(uniqueLive.values()).map((t) => withLiveValues(t, liveById[t.transactionId || t.id]));
    const liveKeys = new Set(live.map((transaction) => transaction.transactionId || transaction.id));
    // Do not let a stale stored/completed copy hide the live version of the same session.
    const completedOrHistorical = filtered.filter(
      (transaction) => !liveKeys.has(transaction.transactionId || transaction.id)
    );
    const isLive = (transaction: Transaction) =>
      (transaction.stoppedAt == null && !isStuckSession(transaction)) ||
      activeTransactionIds.has(transaction.id) ||
      activeTransactionIds.has(transaction.transactionId);
    return [...live, ...completedOrHistorical].filter((transaction) =>
      onShownPlatform(transaction) &&
      matchesTransactionFilters(transaction, filters, isLive(transaction), cpoMobileNumbers)
    );
  }, [allTransactions, activeTransactions, activeTransactionIds, datePreset, customFrom, customTo, filters, cpoMobileNumbers, liveById, onShownPlatform]);
  const locationOptions = useMemo(
    () => [...new Set(allTransactions.map((transaction) => transaction.location).filter(Boolean))].sort(),
    [allTransactions]
  );
  const chargerOptions = useMemo(
    () => [...new Set(allTransactions.map(chargerLabel).filter(Boolean))].sort(),
    [allTransactions]
  );
  const filtersActive = Object.values(filters).some((value) => value.trim() !== "");
  // One chip per filter that is set, named the way the popover names it.
  const activeFilters = useMemo(() => {
    const names: Partial<Record<keyof TransactionFilters, string>> = {
      location: "Location", charger: "Charger", current: "Current", status: "Status",
      customer: "Customer", minKwh: "Min kWh",
    };
    const values: Record<string, string> = {
      ac: "AC only", dc: "DC only", live: "Live", completed: "Completed", failed: "Failed",
      cpo: "CPO", regular: "Regular",
    };
    return (Object.keys(names) as Array<keyof TransactionFilters>)
      .filter((key) => filters[key].trim() !== "")
      .map((key) => ({
        key,
        label: names[key] as string,
        value: key === "minKwh" ? `${filters[key]} and up` : key === "location" ? displayLocation(filters[key]) : values[filters[key]] ?? filters[key],
      }));
  }, [filters]);
  const activeFilterCount = activeFilters.length;
  const count = transactions.length;

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => compareTransactions(a, b, sort ?? DEFAULT_TABLE_SORT)),
    [transactions, sort]
  );
  const pagedTransactions = sortedTransactions.slice((page - 1) * pageSize, page * pageSize);

  function exportTransactionsCsv() {
    // Export every row matching the selected table date filter, not only the
    // current pagination page or the visible table columns, in the order the table shows them.
    // The merged columns are left out: their parts are already here, each in its own column.
    const exported = CMS_COLUMN_IDS.filter((columnId) => columnId !== "vehicle" && columnId !== "soc");
    const headers = exported.map((columnId) => CMS_COLUMN_LABELS[columnId] ?? columnId);
    const csvCell = (value: unknown) => {
      // neutralizeCsvCell stops spreadsheet formula injection from customer-controlled text.
      const text = neutralizeCsvCell(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = sortedTransactions.map((transaction) =>
      exported.map((columnId) =>
        csvCell(
          columnId === "id" || columnId === "transactionId"
            ? displaySessionId(transaction.provider, transaction[columnId])
            : columnId === "location"
              ? displayLocation(transaction.location)
              : transaction[columnId as keyof Transaction]
        )
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
  // From the location list, not the filtered rows, so a quiet day doesn't show 0.
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

  // Click a heading to sort by it: ascending, then descending, then back to the table's own
  // order (latest first). The heading is still draggable, which is a different gesture.
  function sortByColumn(column: CmsColumnId) {
    setSort((current) => {
      if (!current || current.column !== column) return { column, direction: "asc" };
      return current.direction === "asc" ? { column, direction: "desc" } : null;
    });
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
  const manyPlatforms = shownPlatforms.length > 1;
  // The matrix columns: Today, then the current cycle and the one before, each carrying one
  // split per platform shown.
  const cycleColumn = (index: number): MatrixPeriod => {
    const short = index === 0 ? "Current cycle" : "Previous cycle";
    const dates = (platformMetrics ?? []).map((metrics) => metrics.cycles[index]?.dates ?? "");
    return {
      // With one platform the dates belong in the heading's tooltip; with more they are listed
      // under it, since each platform closes its cycle on its own day.
      title: dates.length === 1 ? `${short} (${dates[0]})` : short,
      short,
      dates,
      splits: platformMetrics ? platformMetrics.map((metrics) => metrics.cycles[index]?.split ?? null) : [null],
    };
  };
  const matrixPeriods: MatrixPeriod[] = [
    { title: "Today", short: "Today", dates: [], splits: platformMetrics ? platformMetrics.map((metrics) => metrics.today) : [null] },
    cycleColumn(0),
    cycleColumn(1),
  ];
  const filterSelectClass =
    "w-full rounded-lg border border-line bg-soft px-2 py-1.5 text-xs text-ink outline-none hover:bg-soft";
  const filterLabelClass = "mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted first:mt-0";

  return (
    <>
      <main className="cms-dashboard min-h-screen bg-page px-4 pb-12 pt-6 text-ink sm:px-6 sm:pb-16 lg:px-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <section className="relative z-10 mb-6 overflow-visible rounded-xl border border-line/80 bg-surface p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              CMS Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Operational overview of charging sessions, chargers, locations, energy and revenue from the connected CMS.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PlatformSelect options={platformOptions} selection={selection} onChange={setPlatform} />
            <StationSelect options={stationOptions} stationId={stationId} onChange={setStation} />
            {dataTill && (
              <p className="text-xs text-muted">
                Data till{" "}
                {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(dataTill))}
              </p>
            )}
            {isPartner && <button
              type="button"
              onClick={() => void startHistoricalBackfill()}
              disabled={backfillRunning}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Activity size={16} className={backfillRunning ? "motion-safe:animate-pulse" : ""} />
              {backfillRunning ? "Backfill running…" : "Start history backfill"}
            </button>}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-3.5 py-2 text-sm font-semibold text-ink hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
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
              className="rounded-lg border border-red-200 bg-surface px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {/* The matrix and Consumption are one pair that stretch to each other's height;
            Status sits beside them, capped to that height so opening a session scrolls
            inside the card instead of growing the page. */}
        <div className="relative z-0 mb-6 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,42.5rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,49rem)_minmax(0,1fr)]">
          <div ref={pairRef} className="grid min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,13.5rem)] xl:grid-cols-[minmax(0,33rem)_minmax(0,15rem)]">
            <PeriodMatrixCard platforms={shownPlatforms} periods={matrixPeriods} />
            <ConsumptionCard platformMetrics={platformMetrics} manyPlatforms={manyPlatforms} />
          </div>
          <div className="min-w-0 overflow-y-auto" style={pairHeight ? { maxHeight: pairHeight } : undefined}>
            <StatusCard connectors={connectors} count={activeCount} sessions={liveShown} liveById={liveById} showLocation={locationCount > 1} showProvider={manyPlatforms} />
          </div>
        </div>

        <GlassCard className="mt-6 overflow-visible rounded-xl border border-line/80 bg-surface p-0 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-ink">Transactions</h2>
              <p className="text-xs text-muted">
                {datePresets.find((preset) => preset.value === datePreset)?.label}
                {filtersActive ? " · filtered" : ""} · {count} matching
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportTransactionsCsv}
                disabled={waiting || transactions.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50"
                title={`Export all ${count} transactions matching the selected filters`}
              >
                <Download size={14} />
                Export CSV
              </button>
              <label className="flex items-center gap-2 text-xs text-muted">
                <span>Date:</span>
                <select
                  value={datePreset}
                  onChange={(event) => selectDatePreset(event.target.value as DatePreset)} disabled={waiting}
                  className="rounded-lg border border-line bg-soft px-2 py-2 text-xs text-ink outline-none hover:bg-soft"
                  aria-label="Date range"
                >
                  {datePresets.map((preset) => (
                    <option key={preset.value} value={preset.value} className="bg-surface">
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
                    className="rounded-lg border border-line bg-soft px-2 py-2 text-xs text-ink outline-none hover:bg-soft"
                    aria-label="From date"
                  />
                  <span className="text-xs text-muted">to</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customMinDate}
                    max={customMaxDate}
                    onChange={(event) => { if (event.target.value) { setCustomTo(event.target.value); setPage(1); } }}
                    className="rounded-lg border border-line bg-soft px-2 py-2 text-xs text-ink outline-none hover:bg-soft"
                    aria-label="To date"
                  />
                </>
              )}
              <label className="flex items-center gap-2 text-xs text-muted">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(event) => selectPageSize(Number(event.target.value))} disabled={Boolean(message)}
                  className="rounded-lg border border-line bg-soft px-2 py-2 text-xs text-ink outline-none hover:bg-soft"
                  aria-label="Transactions per page"
                >
                  <option value={25} className="bg-surface">25</option>
                  <option value={50} className="bg-surface">50</option>
                  <option value={100} className="bg-surface">100</option>
                </select>
              </label>
              <div ref={columnEditorRef} className="relative">
                <button
                  onClick={openColumnEditor}
                  disabled={!columnsLoaded}
                  className="inline-flex items-center gap-2 rounded-lg border border-line bg-soft px-3 py-2 text-xs font-semibold text-ink hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Settings2 size={14} />
                  Columns
                </button>
                {columnEditorOpen && (
                  <div ref={columnMenuRef} className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-line bg-surface p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-ink">Columns & fields</p>
                        <p className="text-xs text-muted">Add or remove fields from the table, then drag selected fields to set their order.</p>
                      </div>
                      <button onClick={closeColumnEditor} className="rounded-lg p-1 text-lg leading-none text-muted hover:bg-soft hover:text-ink" aria-label="Close columns">×</button>
                    </div>
                    <div className="mb-3 flex items-center justify-between">
                      <button onClick={() => setDraftColumns(DEFAULT_CMS_COLUMNS)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
                        <RotateCcw size={13} /> Reset
                      </button>
                      <span className="text-xs text-muted">{draftColumns.length} of {CMS_COLUMNS.length} selected</span>
                    </div>
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Selected fields · drag to reorder</p>
                        <div className="space-y-1">
                          {draftColumns.map((columnId) => {
                            const column = CMS_COLUMNS.find((item) => item.id === columnId);
                            if (!column) return null;
                            return (
                              <div key={column.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/cms-column", column.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const dragged = event.dataTransfer.getData("text/cms-column") as CmsColumnId; if (dragged) reorderTableColumn(dragged, column.id); }} className="flex cursor-grab items-center gap-2 rounded-lg border border-line bg-raised px-2 py-2 active:cursor-grabbing">
                                <input type="checkbox" checked onChange={() => toggleColumn(column.id)} className="h-4 w-4 accent-primary" />
                                <span className="font-mono text-xs text-ink">{column.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="border-t border-line pt-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Available</p>
                        <div className="space-y-1">
                          {CMS_COLUMN_IDS.filter((columnId) => !draftColumns.includes(columnId)).map((columnId) => {
                            const column = CMS_COLUMNS.find((item) => item.id === columnId);
                            if (!column) return null;
                            return (
                              <label key={column.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-soft">
                                <input type="checkbox" checked={false} onChange={() => toggleColumn(column.id)} className="h-4 w-4 accent-primary" />
                                <span className="font-mono text-xs text-ink">{column.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-3">
                      <button onClick={closeColumnEditor} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-muted hover:bg-soft">Cancel</button>
                      <button onClick={() => void saveColumnPreferences(draftColumns)} disabled={savingColumns || draftColumns.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
                        <Save size={13} /> {savingColumns ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-2.5">
            <div className="relative w-full sm:w-72">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Search name, mobile, vehicle, ID"
                className="w-full rounded-full border-0 bg-raised py-2 pl-8 pr-3 text-xs text-ink outline-none focus:ring-2 focus:ring-focus-ring/25"
                aria-label="Search transactions"
              />
            </div>
            {/* Six dropdowns in a wrapping strip became one button: what is set shows as a chip
                under it, so the row keeps its height whatever is filtered. */}
            <div ref={filterMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setFilterMenuOpen((open) => !open)}
                aria-expanded={filterMenuOpen}
                className="inline-flex items-center gap-2 rounded-full bg-raised px-3 py-2 text-xs font-semibold text-ink hover:bg-soft"
              >
                <SlidersHorizontal size={13} className="text-muted" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-ink">{activeFilterCount}</span>
                )}
              </button>
              {filterMenuOpen && (
                <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-surface p-3 shadow-xl">
                  <p className={filterLabelClass}>Location</p>
                  <select
                    value={filters.location}
                    onChange={(event) => updateFilter("location", event.target.value)}
                    className={filterSelectClass}
                    aria-label="Location"
                  >
                    <option value="" className="bg-surface">All locations</option>
                    {locationOptions.map((location) => (
                      <option key={location} value={location} className="bg-surface">{displayLocation(location)}</option>
                    ))}
                  </select>
                  <p className={filterLabelClass}>Charger</p>
                  <select
                    value={filters.charger}
                    onChange={(event) => updateFilter("charger", event.target.value)}
                    className={filterSelectClass}
                    aria-label="Charger"
                  >
                    <option value="" className="bg-surface">All chargers</option>
                    {chargerOptions.map((charger) => (
                      <option key={charger} value={charger} className="bg-surface">{charger}</option>
                    ))}
                  </select>
                  <p className={filterLabelClass}>Current</p>
                  <select
                    value={filters.current}
                    onChange={(event) => updateFilter("current", event.target.value as TransactionFilters["current"])}
                    className={filterSelectClass}
                    aria-label="AC or DC"
                  >
                    <option value="" className="bg-surface">AC &amp; DC</option>
                    <option value="ac" className="bg-surface">AC only</option>
                    <option value="dc" className="bg-surface">DC only</option>
                  </select>
                  <p className={filterLabelClass}>Status</p>
                  <select
                    value={filters.status}
                    onChange={(event) => updateFilter("status", event.target.value as TransactionFilters["status"])}
                    className={filterSelectClass}
                    aria-label="Status"
                  >
                    <option value="" className="bg-surface">All statuses</option>
                    <option value="live" className="bg-surface">Live</option>
                    <option value="completed" className="bg-surface">Completed</option>
                    <option value="failed" className="bg-surface">Failed (0 kWh)</option>
                  </select>
                  <p className={filterLabelClass}>Customer</p>
                  <select
                    value={filters.customer}
                    onChange={(event) => updateFilter("customer", event.target.value as TransactionFilters["customer"])}
                    className={filterSelectClass}
                    aria-label="Customer type"
                  >
                    <option value="" className="bg-surface">All customers</option>
                    <option value="cpo" className="bg-surface">CPO</option>
                    <option value="regular" className="bg-surface">Regular</option>
                  </select>
                  <p className={filterLabelClass}>Minimum energy</p>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={filters.minKwh}
                    onChange={(event) => updateFilter("minKwh", event.target.value)}
                    placeholder="0 kWh"
                    className={filterSelectClass}
                    aria-label="Minimum energy in kWh"
                  />
                </div>
              )}
            </div>
            {/* What is set, and the way back out of it. */}
            {activeFilters.map((filter) => (
              <span key={filter.key} className="inline-flex items-center gap-1.5 rounded-full bg-accent-pale py-1 pl-2.5 pr-1 text-[11px] font-medium text-ink">
                {filter.label} <b className="font-bold">{filter.value}</b>
                <button
                  type="button"
                  onClick={() => updateFilter(filter.key, "" as never)}
                  className="rounded-full p-0.5 text-muted hover:bg-soft hover:text-ink"
                  aria-label={`Remove the ${filter.label.toLowerCase()} filter`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {filtersActive && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-muted hover:bg-soft hover:text-ink"
              >
                <RotateCcw size={12} /> Clear all
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[880px] w-full border-collapse text-left text-sm">
              <thead className="bg-raised text-xs uppercase tracking-wider text-muted">
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
                        aria-sort={sort?.column === column.id ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                        className={[
                          "whitespace-nowrap px-4 py-3 select-none",
                          draggedTableColumn === column.id
                            ? "bg-emerald-300/10 text-emerald-700"
                            : "cursor-grab active:cursor-grabbing",
                        ].join(" ")}
                        title="Click to sort, drag to reorder"
                      >
                        <button
                          type="button"
                          onClick={() => sortByColumn(column.id)}
                          className="group inline-flex items-center gap-1 uppercase tracking-wider text-muted hover:text-ink"
                        >
                          {column.label}
                          {sort?.column === column.id
                            ? (sort.direction === "asc" ? <ArrowUp size={11} className="text-ink" /> : <ArrowDown size={11} className="text-ink" />)
                            : <ChevronsUpDown size={11} className="opacity-0 transition-opacity group-hover:opacity-60" />}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pagedTransactions.map((transaction) => {
                  const isActive =
                    transaction.stoppedAt == null &&
                    !isStuckSession(transaction) &&
                    (activeTransactionIds.has(transaction.id) ||
                      activeTransactionIds.has(transaction.transactionId));

                  return (
                    <tr key={transaction.id} className="hover:bg-raised">
                      {visibleColumns.map((columnId) => (
                        <td key={columnId} className="whitespace-nowrap px-4 py-3 text-muted">
                          {columnId === "id" && displaySessionId(transaction.provider, transaction.id)}
                          {columnId === "transactionId" && displaySessionId(transaction.provider, transaction.transactionId)}
                          {columnId === "chargerId" && transaction.chargerId}
                          {columnId === "connectorId" && (transaction.connectorId ?? "—")}
                          {columnId === "vehicle" && (
                            <CellPopover
                              title="Customer details"
                              trigger={
                                <>
                                  <span className="block font-mono text-[12.5px] font-semibold tracking-[-0.02em] text-ink">{transaction.vehicleNumber?.trim() || "—"}</span>
                                  <span className="block text-[11px] text-muted">{displayUserName(transaction.userName)}</span>
                                </>
                              }
                            >
                              <DetailRow label="Customer" value={displayUserName(transaction.userName)} />
                              <DetailRow label="Mobile" value={transaction.mobile ? <Spoiler>{transaction.mobile}</Spoiler> : "—"} />
                              <DetailRow label="User type" value={transaction.userType ?? "—"} />
                              <DetailRow label="Vehicle" value={transaction.vehicleName ?? "—"} />
                              <DetailRow label="Vehicle number" value={transaction.vehicleNumber?.trim() || "—"} />
                              <DetailRow label="Tag reference" value={transaction.tagReference ?? "—"} />
                            </CellPopover>
                          )}
                          {columnId === "soc" && (
                            <CellPopover title="Charge details" trigger={socRange(transaction.startSoc, transaction.endSoc)}>
                              <DetailRow label="Start SoC" value={transaction.startSoc == null ? "—" : `${transaction.startSoc}%`} />
                              <DetailRow label="End SoC" value={transaction.endSoc == null ? "—" : `${transaction.endSoc}%`} />
                              <DetailRow label="Energy" value={transaction.energyKwh == null ? "—" : formatKwh(transaction.energyKwh)} />
                              <DetailRow label="Charger" value={displayChargerWithGun(transaction.chargerName, transaction.connectorId)} />
                              <DetailRow label="Stop reason" value={transaction.stopReason ?? "—"} />
                            </CellPopover>
                          )}
                          {columnId === "startedAt" && (
                            <>
                              {formatDate(transaction.startedAt)}
                              {manyPlatforms && <span className="mt-0.5 block text-[10px] text-muted">{providerLabel(transaction.provider)}</span>}
                            </>
                          )}
                          {columnId === "stoppedAt" && formatDate(transaction.stoppedAt)}
                          {columnId === "userName" && displayUserName(transaction.userName)}
                          {columnId === "mobile" && (transaction.mobile ? <Spoiler>{transaction.mobile}</Spoiler> : "—")}
                          {columnId === "userType" && (transaction.userType ?? "—")}
                          {columnId === "tagReference" && (transaction.tagReference ?? "—")}
                          {columnId === "location" && displayLocation(transaction.location)}
                          {columnId === "locationId" && (transaction.locationId ?? "—")}
                          {columnId === "chargerName" && shortChargerLabel(transaction.chargerName, transaction.stationType, transaction.connectorId).replace(/^(AC|DC) /, "")}
                          {columnId === "stationType" && (transaction.stationType ?? "—")}
                          {columnId === "stopReason" && (transaction.stopReason ?? "—")}
                          {columnId === "energyKwh" && (
                            <CellPopover
                              title="Energy details"
                              trigger={transaction.energyKwh == null ? "—" : formatKwh(transaction.energyKwh)}
                            >
                              <DetailRow label="Energy" value={transaction.energyKwh == null ? "—" : formatKwh(transaction.energyKwh)} />
                              <DetailRow label="Meter start" value={transaction.startValue ?? "—"} />
                              <DetailRow label="Meter stop" value={transaction.stopValue ?? "—"} />
                            </CellPopover>
                          )}
                          {columnId === "startSoc" && (transaction.startSoc == null ? "—" : `${transaction.startSoc}%`)}
                          {columnId === "endSoc" && (transaction.endSoc == null ? "—" : `${transaction.endSoc}%`)}
                          {columnId === "vehicleName" && (transaction.vehicleName ?? "—")}
                          {columnId === "vehicleNumber" && (transaction.vehicleNumber ? <span className="font-mono text-ink">{transaction.vehicleNumber}</span> : "—")}
                          {columnId === "tariffAmount" && (
                            <CellPopover
                              title="Amount details"
                              trigger={transaction.tariffAmount == null ? "—" : money(transaction.tariffAmount)}
                            >
                              <DetailRow label="Amount" value={transaction.tariffAmount == null ? "—" : money(transaction.tariffAmount)} />
                              <DetailRow label="Energy" value={transaction.energyKwh == null ? "—" : formatKwh(transaction.energyKwh)} />
                              <DetailRow label="VAT" value={transaction.vat ?? "—"} />
                              <DetailRow label="Base deductive" value={transaction.baseDeductiveAmount ?? "—"} />
                              <DetailRow label="Free session" value={transaction.isFree == null ? "—" : transaction.isFree ? "Yes" : "No"} />
                              <DetailRow label="Time-based tariff" value={transaction.isTimeBasedTariff == null ? "—" : transaction.isTimeBasedTariff ? "Yes" : "No"} />
                              <DetailRow label="Invoice" value={transaction.invoiceAvailable ? "Available" : "—"} />
                            </CellPopover>
                          )}
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
                {waiting && (
                  <tr><td colSpan={visibleColumns.length} className="px-4 py-10">
                    <Loader size="sm" title="Loading sessions…" />
                  </td></tr>
                )}
                {!loading && transactions.length === 0 && (
                  <tr><td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-muted">
                    {filtersActive ? (
                      <>
                        No transactions match these filters.{" "}
                        <button onClick={clearFilters} className="font-semibold text-accent hover:text-accent">Clear filters</button>
                      </>
                    ) : (
                      "No transactions in this date range."
                    )}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line bg-raised px-5 py-4">
            <span className="text-xs text-muted">
              Page {page} of {Math.max(1, Math.ceil(count / pageSize))}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || waiting}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted disabled:opacity-30"
              >
                Previous
              </button>
              <button
                disabled={page >= Math.max(1, Math.ceil(count / pageSize)) || waiting}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted disabled:opacity-30"
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


// Site names from ChargeMOD, shortened like the table's Location column; green when a car is charging there.
