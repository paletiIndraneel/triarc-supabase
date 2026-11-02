import { useRef, useState } from "react";
import { type CmsColumnId, EMPTY_TRANSACTION_FILTERS, type TransactionFilters } from "./transactionFilters";
import { DEFAULT_CMS_COLUMNS } from "./cmsHelpers";
import { type DatePreset, istDateString } from "./dateRanges";
import type { TableSort } from "./cmsHelpers";

// The sessions table's own state: paging, sort, filters, the date range and the columns. The
// component reads it through this hook, so the table can later move out without its state.
export function useSessionsTableState() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // No sort of its own until a heading is clicked: the table's own order is the latest session
  // first, which is what most visits are after.
  const [sort, setSort] = useState<TableSort | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset | "custom">("today");
  const [customFrom, setCustomFrom] = useState(() => istDateString().slice(0, 8) + "01");
  const [customTo, setCustomTo] = useState(() => istDateString());
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_TRANSACTION_FILTERS);
  const [visibleColumns, setVisibleColumns] = useState<CmsColumnId[]>(DEFAULT_CMS_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<CmsColumnId[]>(DEFAULT_CMS_COLUMNS);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [savingColumns, setSavingColumns] = useState(false);
  const [columnsLoaded, setColumnsLoaded] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const columnEditorRef = useRef<HTMLDivElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [draggedTableColumn, setDraggedTableColumn] = useState<CmsColumnId | null>(null);
  return { page, setPage, pageSize, setPageSize, sort, setSort, datePreset, setDatePreset, customFrom, setCustomFrom, customTo, setCustomTo, filters, setFilters, visibleColumns, setVisibleColumns, draftColumns, setDraftColumns, columnEditorOpen, setColumnEditorOpen, savingColumns, setSavingColumns, columnsLoaded, setColumnsLoaded, filterMenuOpen, setFilterMenuOpen, filterMenuRef, columnEditorRef, columnMenuRef, draggedTableColumn, setDraggedTableColumn };
}
