// Client-side filters for the CMS transactions table; they run on already-fetched rows.

type FilterableTransaction = {
  id: string;
  transactionId: string;
  chargerId: string;
  chargerName: string;
  stationType: string | null;
  location: string;
  type: string | null;
  userName: string;
  mobile: string | null;
  vehicleNumber: string | null;
  energyKwh: number | null;
};

export type TransactionStatus = "live" | "completed" | "failed";

export type TransactionFilters = {
  location: string;
  charger: string;
  current: "" | "ac" | "dc";
  status: "" | TransactionStatus;
  customer: "" | "cpo" | "regular";
  search: string;
  minKwh: string;
};

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  location: "",
  charger: "",
  current: "",
  status: "",
  customer: "",
  search: "",
  minKwh: "",
};

export function chargerLabel(transaction: FilterableTransaction) {
  return transaction.chargerName || transaction.chargerId;
}

// Same AC/DC rule the month-to-date consumption split uses.
export function chargerCurrent(transaction: FilterableTransaction): "ac" | "dc" | null {
  const type =
    `${transaction.stationType ?? ""} ${transaction.chargerName ?? ""} ${transaction.chargerId ?? ""}`.toLowerCase();
  if (/\bac\b|ac charger|alternating current/.test(type)) return "ac";
  if (/\bdc\b|dc charger|direct current/.test(type)) return "dc";
  return null;
}

function normalizeMobile(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

// ChargeMOD's transaction type always wins; only when it is empty do the CPO Settings
// mobile numbers decide.
export function isCpoTransaction(transaction: FilterableTransaction, cpoMobileNumbers: Set<string>) {
  const type = transaction.type?.trim().toUpperCase();
  if (type) return type === "CPO";
  const mobile = normalizeMobile(transaction.mobile);
  return mobile !== null && cpoMobileNumbers.has(mobile);
}

// A finished session that delivered no energy is treated as failed.
export function transactionStatus(transaction: FilterableTransaction, isLive: boolean): TransactionStatus {
  if (isLive) return "live";
  return (transaction.energyKwh ?? 0) > 0 ? "completed" : "failed";
}

export function matchesTransactionFilters(
  transaction: FilterableTransaction,
  filters: TransactionFilters,
  isLive: boolean,
  cpoMobileNumbers: Set<string>
) {
  if (filters.location && transaction.location !== filters.location) return false;
  if (filters.charger && chargerLabel(transaction) !== filters.charger) return false;
  if (filters.current && chargerCurrent(transaction) !== filters.current) return false;
  if (filters.status && transactionStatus(transaction, isLive) !== filters.status) return false;
  if (filters.customer && isCpoTransaction(transaction, cpoMobileNumbers) !== (filters.customer === "cpo")) {
    return false;
  }

  const minKwh = Number(filters.minKwh);
  if (filters.minKwh.trim() && Number.isFinite(minKwh) && (transaction.energyKwh ?? 0) < minKwh) {
    return false;
  }

  const search = filters.search.trim().toLowerCase();
  if (search) {
    const haystack = [
      transaction.userName,
      transaction.mobile,
      transaction.vehicleNumber,
      transaction.transactionId,
      transaction.id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  return true;
}
