"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { getCmsWindowSnapshot, requestCmsWindow, subscribeCmsWindow, type CmsWindowSnapshot } from "./cmsWindowStore";
import { type DatePreset, getCustomRangeIST, getDateRangeIST, istDateString } from "./dateRanges";
import { CMS_COLUMN_IDS, type CmsColumnId, displayLocation, EMPTY_TRANSACTION_FILTERS, type TransactionFilters, chargerLabel, matchesTransactionFilters, shortChargerLabel, splitActiveSessions, isStuckSession } from "./transactionFilters";
import { neutralizeCsvCell } from "@/lib/security";
import { cycleLabel, cyclesBack, previousBillingCycle } from "@/lib/billingCycle";
import { ConsumptionCard, type PlatformMetrics } from "./cmsConsumptionCard";
import { cycleRuleFor } from "@/lib/cms/providers";
import type { CmsCache, Dashboard, Transaction } from "./cmsCache";
import { fetchColumnPreferences, mergeTransactionData, rememberColumnPreferences } from "./cmsCache";
import { displaySessionId } from "@/lib/cms/providerIds";
import { matchCpoMobiles } from "./cpoNumbersCache";
import { useLiveMetrics, withLiveValues } from "./useLiveMetrics";
import { StationSelect, useStationSelection } from "./stationSelection";
import { PlatformSelect, usePlatformSelection } from "./platformSelection";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { filterTransactionsByRange, CMS_COLUMN_LABELS, DEFAULT_CMS_COLUMNS, DEFAULT_TABLE_SORT, compareTransactions, collectionLength, splitPeriod } from "./cmsHelpers";
import { useSessionsTableState } from "./useSessionsTableState";
import { PeriodMatrixCard, type MatrixPeriod } from "./cmsMatrixCard";
import { StatusCard, type ConnectorState } from "./cmsStatusCard";
import { SessionsCard } from "./cmsSessionsCard";


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

        <SessionsCard
          datePresets={datePresets}
          saveColumnPreferences={saveColumnPreferences}
          activeFilterCount={activeFilterCount}
          activeFilters={activeFilters}
          activeTransactionIds={activeTransactionIds}
          chargerOptions={chargerOptions}
          clearFilters={clearFilters}
          closeColumnEditor={closeColumnEditor}
          columnEditorOpen={columnEditorOpen}
          columnEditorRef={columnEditorRef}
          columnMenuRef={columnMenuRef}
          columnsLoaded={columnsLoaded}
          count={count}
          customFrom={customFrom}
          customMaxDate={customMaxDate}
          customMinDate={customMinDate}
          customTo={customTo}
          datePreset={datePreset}
          draftColumns={draftColumns}
          draggedTableColumn={draggedTableColumn}
          exportTransactionsCsv={exportTransactionsCsv}
          filterLabelClass={filterLabelClass}
          filterMenuOpen={filterMenuOpen}
          filterMenuRef={filterMenuRef}
          filterSelectClass={filterSelectClass}
          filters={filters}
          filtersActive={filtersActive}
          loading={loading}
          locationOptions={locationOptions}
          manyPlatforms={manyPlatforms}
          message={message}
          openColumnEditor={openColumnEditor}
          page={page}
          pageSize={pageSize}
          pagedTransactions={pagedTransactions}
          reorderTableColumn={reorderTableColumn}
          savingColumns={savingColumns}
          selectDatePreset={selectDatePreset}
          selectPageSize={selectPageSize}
          setCustomFrom={setCustomFrom}
          setCustomTo={setCustomTo}
          setDraftColumns={setDraftColumns}
          setDraggedTableColumn={setDraggedTableColumn}
          setFilterMenuOpen={setFilterMenuOpen}
          setPage={setPage}
          sort={sort}
          sortByColumn={sortByColumn}
          toggleColumn={toggleColumn}
          transactions={transactions}
          updateFilter={updateFilter}
          visibleColumns={visibleColumns}
          waiting={waiting}
        />
      </div>
    </main>
    </>
  );
}


// Site names from ChargeMOD, shortened like the table's Location column; green when a car is charging there.
