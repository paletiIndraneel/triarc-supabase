import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { neutralizeCsvCell } from "@/lib/security";
import { displaySessionId } from "@/lib/cms/providerIds";
import { fetchColumnPreferences, mergeTransactionData, rememberColumnPreferences, type Transaction } from "./cmsCache";
import { CMS_COLUMN_LABELS, compareTransactions, DEFAULT_CMS_COLUMNS, DEFAULT_TABLE_SORT, filterTransactionsByRange } from "./cmsHelpers";
import { type DatePreset, getCustomRangeIST, getDateRangeIST, istDateString } from "./dateRanges";
import { CMS_COLUMN_IDS, chargerLabel, type CmsColumnId, displayLocation, EMPTY_TRANSACTION_FILTERS, isStuckSession, matchesTransactionFilters, type TransactionFilters } from "./transactionFilters";
import { withLiveValues, type LiveState } from "./useLiveMetrics";
import { useSessionsTableState } from "./useSessionsTableState";

// The sessions table: its state, the filtered, sorted and paged rows, the column editor and the
// CSV export. The dashboard passes the loaded data in and spreads the result into SessionsCard.
export type SessionsTableInput = {
  allTransactions: Transaction[];
  activeTransactions: Transaction[];
  activeTransactionIds: Set<string>;
  cpoMobileNumbers: Set<string>;
  onShownPlatform: (transaction: Transaction) => boolean;
  setMessage: Dispatch<SetStateAction<string>>;
  liveById: Record<string, LiveState>;
};

export function useSessionsTable(input: SessionsTableInput) {
  const { allTransactions, activeTransactions, activeTransactionIds, cpoMobileNumbers, onShownPlatform, setMessage, liveById } = input;
  const { page, setPage, pageSize, setPageSize, sort, setSort, datePreset, setDatePreset, customFrom, setCustomFrom, customTo, setCustomTo, filters, setFilters, visibleColumns, setVisibleColumns, draftColumns, setDraftColumns, columnEditorOpen, setColumnEditorOpen, savingColumns, setSavingColumns, columnsLoaded, setColumnsLoaded, filterMenuOpen, setFilterMenuOpen, filterMenuRef, columnEditorRef, columnMenuRef, draggedTableColumn, setDraggedTableColumn } = useSessionsTableState();

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

  const filterSelectClass =
    "w-full rounded-lg border border-line bg-soft px-2 py-1.5 text-xs text-ink outline-none hover:bg-soft";
  const filterLabelClass = "mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted first:mt-0";
  return { transactions, locationOptions, chargerOptions, filtersActive, activeFilters, activeFilterCount, count, sortedTransactions, pagedTransactions, datePresets, customMinDate, customMaxDate, filterSelectClass, filterLabelClass, saveColumnPreferences, toggleColumn, reorderTableColumn, openColumnEditor, closeColumnEditor, exportTransactionsCsv, selectDatePreset, updateFilter, clearFilters, sortByColumn, selectPageSize, page, setPage, pageSize, setPageSize, sort, setSort, datePreset, setDatePreset, customFrom, setCustomFrom, customTo, setCustomTo, filters, setFilters, visibleColumns, setVisibleColumns, draftColumns, setDraftColumns, columnEditorOpen, setColumnEditorOpen, savingColumns, setSavingColumns, columnsLoaded, setColumnsLoaded, filterMenuOpen, setFilterMenuOpen, filterMenuRef, columnEditorRef, columnMenuRef, draggedTableColumn, setDraggedTableColumn };
}

export type SessionsTable = ReturnType<typeof useSessionsTable>;
