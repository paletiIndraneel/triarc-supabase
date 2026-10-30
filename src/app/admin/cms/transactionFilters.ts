// Client-side filters for the CMS transactions table; they run on already-fetched rows.

type FilterableTransaction = {
  provider?: string;
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
  startedAt?: string | null;
  stoppedAt?: string | null;
  connectorId?: number | null;
};

export type TransactionStatus = "live" | "completed" | "failed";

export type TransactionFilters = {
  provider: string; // a platform id from @/lib/cms/providerIds, "" for all
  location: string;
  charger: string;
  current: "" | "ac" | "dc";
  status: "" | TransactionStatus;
  customer: "" | "cpo" | "regular";
  search: string;
  minKwh: string;
};

export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  provider: "",
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

// Short charger name for the Active now card, built from ChargeMOD's charger name and gun:
// "Triarc | DC 60kW CCS-2" gun 2 -> "DC 60kW-2", "Triarc | AC 3.3kW Socket | A" -> "AC 3.3kW-A",
// "Triarc | AC 22kW Type-2" -> "22kW". DC chargers always show the gun number (any number of
// guns); AC chargers show it only when they have more than one gun.
export function shortChargerLabel(chargerName: string, stationType: string | null, connectorId: number | null) {
  const parts = chargerName.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && /^triarc/i.test(parts[0])) parts.shift();
  const main = parts[0] ?? "";
  const letter = parts.length > 1 && /^[A-Z0-9]{1,2}$/i.test(parts.at(-1)!) ? parts.at(-1)!.toUpperCase() : null;
  const type = (stationType ?? main.match(/\b(AC|DC)\b/i)?.[1] ?? "").toUpperCase();
  const power = main.match(/(\d+(?:\.\d+)?)\s*kW/i);
  const gun = connectorId != null && connectorId > 0 ? connectorId : null;
  const suffix = letter ? `-${letter}` : gun && (type === "DC" || gun > 1) ? `-${gun}` : "";
  if (!power) return `${main || "Charger"}${letter ? `-${letter}` : gun ? `-${gun}` : ""}`;
  const kw = `${power[1]}kW`;
  return type === "AC" && !suffix ? kw : `${type ? `${type} ` : ""}${kw}${suffix}`;
}

// Same AC/DC rule the month-to-date consumption split uses.
export function chargerCurrent(transaction: FilterableTransaction): "ac" | "dc" | null {
  const type =
    `${transaction.stationType ?? ""} ${transaction.chargerName ?? ""} ${transaction.chargerId ?? ""}`.toLowerCase();
  if (/\bac\b|ac charger|alternating current/.test(type)) return "ac";
  if (/\bdc\b|dc charger|direct current/.test(type)) return "dc";
  return null;
}

export function normalizeMobile(value: string | null | undefined) {
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

// No vehicle charges for longer than this, so a session with no stop time after it is stuck
// (a ChargeMOD ghost, or a stop our sync never received).
export const MAX_SESSION_MS = 7 * 60 * 60 * 1000;

export function isStuckSession(transaction: FilterableTransaction, now = Date.now()) {
  if (transaction.stoppedAt || !transaction.startedAt) return false;
  const started = new Date(transaction.startedAt).getTime();
  return Number.isFinite(started) && now - started > MAX_SESSION_MS;
}

// Splits ChargeMOD's active list into sessions really charging and stuck ones: anything past
// MAX_SESSION_MS, and the older sessions when one gun reports more than one (a gun charges
// one vehicle at a time, so the newest wins). Both lists are oldest first.
export function splitActiveSessions<T extends FilterableTransaction>(sessions: T[], now = Date.now()) {
  const byStart = [...sessions].sort((a, b) => String(a.startedAt ?? "").localeCompare(String(b.startedAt ?? "")));
  const newestPerGun = new Map<string, T>();
  for (const session of byStart) {
    if (isStuckSession(session, now)) continue;
    newestPerGun.set(`${session.chargerId || session.chargerName}|${session.connectorId ?? ""}`, session);
  }
  const live = new Set(newestPerGun.values());
  return { live: byStart.filter((s) => live.has(s)), stuck: byStart.filter((s) => !live.has(s)) };
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
  if (filters.provider && transaction.provider !== filters.provider) return false;
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

// Every column the transactions table can show; also what /api/admin/preferences accepts.
// `vehicle` and `soc` are merged columns: the vehicle number with the customer's name under
// it, and the start and end state of charge in one cell. The parts stay available on their own.
export type CmsColumnId =
  | "vehicle" | "soc"
  | "id" | "transactionId" | "chargerId" | "connectorId" | "startedAt" | "stoppedAt"
  | "userName" | "mobile" | "userType" | "tagReference" | "location" | "locationId"
  | "chargerName" | "stationType" | "stopReason" | "energyKwh" | "startSoc" | "endSoc"
  | "vehicleName" | "vehicleNumber" | "tariffAmount" | "vat" | "invoiceAvailable"
  | "userId" | "vehicleId" | "geoLatitude" | "geoLongitude" | "idTag" | "isFree"
  | "baseDeductiveAmount" | "isAlphaGuaranteed" | "isTimeBasedTariff" | "startValue"
  | "stopValue" | "createdAt" | "updatedAt";

export const CMS_COLUMN_IDS: CmsColumnId[] = [
  "vehicle", "soc",
  "id", "transactionId", "chargerId", "connectorId", "startedAt", "stoppedAt",
  "userName", "mobile", "userType", "tagReference", "location", "locationId",
  "chargerName", "stationType", "stopReason", "energyKwh", "startSoc", "endSoc",
  "vehicleName", "vehicleNumber", "tariffAmount", "vat", "invoiceAvailable",
  "userId", "vehicleId", "geoLatitude", "geoLongitude", "idTag", "isFree",
  "baseDeductiveAmount", "isAlphaGuaranteed", "isTimeBasedTariff", "startValue",
  "stopValue", "createdAt", "updatedAt",
];

// "all", or one station's id (billing_invoice_stations), as chosen in the station selector.
export const ALL_STATIONS = "all";

// A billing_invoice_stations record: one station on one charging platform (provider +
// location_id, empty until linked). Records with the same name are one station in the admin.
export type StationRecord = { id: string; name: string; active: boolean; provider?: string | null; location_id?: string | null; location_name?: string | null };
export type StationGroup<R extends StationRecord> = { name: string; ids: string[]; active: boolean; records: R[] };

export function groupStations<R extends StationRecord>(records: R[]): StationGroup<R>[] {
  const groups = new Map<string, StationGroup<R>>();
  for (const r of records) {
    const g = groups.get(r.name) ?? { name: r.name, ids: [], active: false, records: [] };
    g.ids.push(r.id);
    g.records.push(r);
    g.active ||= r.active;
    groups.set(r.name, g);
  }
  return [...groups.values()].sort((a, b) => displayLocation(a.name).localeCompare(displayLocation(b.name)));
}

// The key a session's platform location is linked to its station by.
export const stationLocationKey = (provider: string | null | undefined, locationId: string | number | null | undefined) =>
  `${provider ?? ""}|${locationId ?? ""}`;

// One station's sessions: those whose platform location is linked to it. "all" keeps every
// session, including those of locations not linked to any station yet.
export function filterByStation<T extends { provider?: string; locationId?: number | string | null }>(
  sessions: T[],
  stationOfLocation: Map<string, string>,
  stationId: string
) {
  if (stationId === ALL_STATIONS) return sessions;
  return sessions.filter((s) => stationOfLocation.get(stationLocationKey(s.provider, s.locationId)) === stationId);
}

// A location as people should read it: Triarc is the company and EV Hub the business, so
// ChargeMOD's "Triarc EV hub | Bhadrachalam" shows as "Bhadrachalam". Stored names stay as the
// platform sends them.
export function displayLocation(value: string) {
  const name = value.trim();
  for (const prefix of ["triarc ev hub |", "triarc |"]) {
    if (name.toLowerCase().startsWith(prefix)) return name.slice(prefix.length).trim() || name;
  }
  return name || value;
}
