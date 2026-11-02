import type { CmsTransaction } from "@/lib/cms/types";
import { CMS_COLUMN_IDS, chargerCurrent, displayLocation, isCpoTransaction, type CmsColumnId } from "./transactionFilters";

type Transaction = CmsTransaction;
export function filterTransactionsByRange(
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

export function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function money(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num(value));
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// The columns the table leads with have names a person would use; the rest keep their field
// name, which is what someone adding a raw field is looking for.
export const CMS_COLUMN_LABELS: Partial<Record<CmsColumnId, string>> = {
  vehicle: "Vehicle & customer",
  soc: "SoC",
  startedAt: "Session",
  stoppedAt: "Ended",
  chargerName: "Charger",
  energyKwh: "Energy",
  tariffAmount: "Amount",
  location: "Location",
  userName: "Customer",
  vehicleNumber: "Vehicle number",
  mobile: "Mobile",
  stopReason: "Stop reason",
};

export const CMS_COLUMNS: Array<{ id: CmsColumnId; label: string }> =
  CMS_COLUMN_IDS.map((id) => ({ id, label: CMS_COLUMN_LABELS[id] ?? id }));

// The merged cells each open a popover of the fields behind them (see CellPopover), so the
// table carries five columns and the rest stay in the column editor; the charger and its gun
// are in the SoC cell's popover.
export const DEFAULT_CMS_COLUMNS: CmsColumnId[] = [
  "startedAt",
  "vehicle",
  "soc",
  "energyKwh",
  "tariffAmount",
];

// What a column is worth when the table is sorted by it. Numbers and dates sort as numbers,
// everything else as text; a missing value always sinks, whichever way the sort runs.
export function sortValue(columnId: CmsColumnId, transaction: Transaction): number | string | null {
  switch (columnId) {
    case "startedAt": case "stoppedAt": case "createdAt": case "updatedAt": {
      const value = transaction[columnId];
      return value ? Date.parse(value) : null;
    }
    case "energyKwh": case "tariffAmount": case "startSoc": case "endSoc":
    case "baseDeductiveAmount": case "startValue": case "stopValue":
      return transaction[columnId] == null ? null : Number(transaction[columnId]);
    // The merged columns sort by what leads them: the vehicle number, and where the car started.
    case "vehicle": return transaction.vehicleNumber ?? null;
    case "soc": return transaction.startSoc == null ? null : Number(transaction.startSoc);
    case "location": return displayLocation(transaction.location) || null;
    case "userName": return displayUserName(transaction.userName) || null;
    default: {
      const value = transaction[columnId as keyof Transaction];
      if (value == null || typeof value === "object") return null;
      return typeof value === "number" ? value : String(value);
    }
  }
}

export type TableSort = { column: CmsColumnId; direction: "asc" | "desc" };

// The table's own order: the latest session first, then older ones.
export const DEFAULT_TABLE_SORT: TableSort = { column: "startedAt", direction: "desc" };

export function compareTransactions(a: Transaction, b: Transaction, sort: TableSort) {
  const left = sortValue(sort.column, a);
  const right = sortValue(sort.column, b);
  if (left == null && right == null) return 0;
  // Rows with nothing in the column sit at the end either way, so a sort never hides them
  // among the figures.
  if (left == null) return 1;
  if (right == null) return -1;
  const order = typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right), "en-IN", { numeric: true });
  return sort.direction === "asc" ? order : -order;
}

// Start and end state of charge in one cell, with the span drawn as a bar: the figure that
// matters is how far the car came, and two columns of percentages did not show it.
export function socRange(start: number | null | undefined, end: number | null | undefined) {
  if (start == null || end == null) return "—";
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="tabular-nums">{start}%</span>
      <span className="relative h-1 w-16 overflow-hidden rounded-full bg-soft" aria-hidden="true">
        <i
          className="absolute inset-y-0 rounded-full bg-emerald-500"
          style={{ left: `${start}%`, width: `${Math.max(end - start, 0)}%` }}
        />
      </span>
      <span className="font-semibold text-ink tabular-nums">{end}%</span>
    </span>
  );
}

export function collectionLength(value: unknown): number {
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

export function cleanDisplayValue(value: string, prefixes: string[]) {
  let cleaned = value.trim();

  for (const prefix of prefixes) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleaned = cleaned.slice(prefix.length).trim();
      break;
    }
  }

  return cleaned || value;
}

export function displayUserName(value: string) {
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

export function displayCharger(value: string) {
  return cleanDisplayValue(value, ["Triarc EV hub |", "Triarc |"]);
}

// ChargeMOD names both guns of a DC charger after the connector standard ("CCS-2"), so the table
// showed the same label for gun 1 and gun 2. Put the gun number in its place.
export function displayChargerWithGun(value: string, connectorId: number | null) {
  const name = displayCharger(value);
  if (connectorId == null || connectorId <= 0) return name;
  return name.replace(/CCS[-\s]*\d+/i, `CCS-${connectorId}`);
}

// CMS UI deployment: column visibility, field adding, and drag-and-drop ordering remain supported; runtime data logic unchanged.
export type PeriodSplit = {
  energy: { total: number; ac: number; dc: number; cpo: number };
  revenue: { total: number; ac: number; dc: number };
};

// AC/DC energy and revenue exclude CPO sessions; the totals include them. CPO energy is one
// figure: the matrix carries AC and DC together on its CPO row.
export function splitPeriod(transactions: Transaction[], cpoMobileNumbers: Set<string>): PeriodSplit {
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

export const formatKwh = (value: number) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 4 })} kWh`;

export const matrixKwh = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 4 });
