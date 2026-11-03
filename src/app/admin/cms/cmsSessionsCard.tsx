import { RefObject, Dispatch, SetStateAction } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, RotateCcw, Save, Search, Settings2, SlidersHorizontal, X } from "lucide-react";
import { CMS_COLUMNS, DEFAULT_CMS_COLUMNS, displayChargerWithGun, displayUserName, formatDate, formatKwh, money, socRange } from "./cmsHelpers";
import { CMS_COLUMN_IDS, displayLocation, isStuckSession, shortChargerLabel } from "./transactionFilters";
import { displaySessionId, providerLabel } from "@/lib/cms/providerIds";
import { CellPopover, DetailRow } from "./CellPopover";
import { Spoiler } from "@/components/ui/Spoiler";
import { Loader } from "@/components/ui/Loader";
import type { DatePreset } from "./dateRanges";
import type { CmsColumnId, TransactionFilters } from "./transactionFilters";
import type { TableSort } from "./cmsHelpers";
import type { Transaction } from "./cmsCache";

export type SessionsCardProps = {
  datePresets: Array<{ value: DatePreset | "custom"; label: string }>;
  saveColumnPreferences: (columns: CmsColumnId[]) => Promise<void>;
  activeFilterCount: number;
  activeFilters: Array<{ key: keyof TransactionFilters; label: string; value: string }>;
  activeTransactionIds: Set<string>;
  chargerOptions: string[];
  clearFilters: () => void;
  closeColumnEditor: () => void;
  columnEditorOpen: boolean;
  columnEditorRef: RefObject<HTMLDivElement | null>;
  columnMenuRef: RefObject<HTMLDivElement | null>;
  columnsLoaded: boolean;
  count: number;
  customFrom: string;
  customMaxDate: string;
  customMinDate: string;
  customTo: string;
  datePreset: DatePreset | "custom";
  draftColumns: CmsColumnId[];
  draggedTableColumn: CmsColumnId | null;
  exportTransactionsCsv: () => void;
  filterLabelClass: string;
  filterMenuOpen: boolean;
  filterMenuRef: RefObject<HTMLDivElement | null>;
  filterSelectClass: string;
  filters: TransactionFilters;
  filtersActive: boolean;
  loading: boolean;
  locationOptions: string[];
  manyPlatforms: boolean;
  message: string;
  openColumnEditor: () => void;
  page: number;
  pageSize: number;
  pagedTransactions: Transaction[];
  reorderTableColumn: (dragged: CmsColumnId, target: CmsColumnId) => void;
  savingColumns: boolean;
  selectDatePreset: (preset: DatePreset | "custom") => void;
  selectPageSize: (value: number) => void;
  setCustomFrom: Dispatch<SetStateAction<string>>;
  setCustomTo: Dispatch<SetStateAction<string>>;
  setDraftColumns: Dispatch<SetStateAction<CmsColumnId[]>>;
  setDraggedTableColumn: Dispatch<SetStateAction<CmsColumnId | null>>;
  setFilterMenuOpen: Dispatch<SetStateAction<boolean>>;
  setPage: Dispatch<SetStateAction<number>>;
  sort: TableSort | null;
  sortByColumn: (column: CmsColumnId) => void;
  toggleColumn: (column: CmsColumnId) => void;
  transactions: Transaction[];
  updateFilter: <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => void;
  visibleColumns: CmsColumnId[];
  waiting: boolean;
};

// The Transactions card: the sessions table with its filters, columns, sorting and paging. Its
// values come from the dashboard's state and callbacks.
export function SessionsCard(props: SessionsCardProps) {
  const { datePresets, saveColumnPreferences, activeFilterCount, activeFilters, activeTransactionIds, chargerOptions, clearFilters, closeColumnEditor, columnEditorOpen, columnEditorRef, columnMenuRef, columnsLoaded, count, customFrom, customMaxDate, customMinDate, customTo, datePreset, draftColumns, draggedTableColumn, exportTransactionsCsv, filterLabelClass, filterMenuOpen, filterMenuRef, filterSelectClass, filters, filtersActive, loading, locationOptions, manyPlatforms, message, openColumnEditor, page, pageSize, pagedTransactions, reorderTableColumn, savingColumns, selectDatePreset, selectPageSize, setCustomFrom, setCustomTo, setDraftColumns, setDraggedTableColumn, setFilterMenuOpen, setPage, sort, sortByColumn, toggleColumn, transactions, updateFilter, visibleColumns, waiting } = props;
  return (
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
              <div className="relative w-full sm:w-56">
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

          {filtersActive && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-2.5">
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
          )}

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
  );
}
