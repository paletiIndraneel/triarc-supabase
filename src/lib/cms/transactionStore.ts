// Pure helpers for the sessions table (SESSIONS_TABLE below): column mapping
// and the delta-sync start. Only type imports, so tests/ can load this file directly.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CmsTransaction, CmsTransactionRow } from "./types";
import type { MeterResult } from "./provider";

// The table every session is stored in: all platforms, with a `provider` column and ids that
// carry the platform prefix (migration 20261021000700). README.txt says how to switch it.
export const SESSIONS_TABLE = "cms_transactions";

// The columns the dashboard reads: everything except the large meter-values JSON.
export const SESSION_COLUMNS = "provider,transaction_id,id,charger_id,connector_id,started_at,stopped_at,user_name,mobile,user_type,tag_reference,location,location_id,charger_name,station_type,type,stop_reason,energy_kwh,start_soc,end_soc,vehicle_name,vehicle_number,tariff_amount,vat,invoice_available,user_id,vehicle_id,geo_latitude,geo_longitude,id_tag,is_free,base_deductive_amount,is_alpha_guaranteed,is_time_based_tariff,start_value,stop_value,created_at,updated_at,invoice_link,organization_id,project_id,solar_type,user_email,vehicle_model_id,starting_balance,ending_balance,synced_at";

// ChargeMOD joins first and last name itself and sends "Guest User undefined" when a part
// is missing. Drops "undefined"/"null" words and extra spaces; "Unknown" when nothing is left.
export function cleanUserName(value: unknown) {
  const name = String(value ?? "").split(/\s+/).filter((word) => word && !/^(undefined|null)$/i.test(word)).join(" ");
  return name || "Unknown";
}

const DAY_MS = 24 * 60 * 60 * 1000;
// An upper bound on a backfill window, not the cycle itself — that lives in @/lib/billingCycle.
// It only has to be at least as long as the longest cycle (a half-month runs to 16 days).
const MAX_BACKFILL_DAYS = 16;

// Checks a backfill window sent by the browser: valid ISO times, from < to, not in the
// future and no longer than a billing cycle. Null when invalid.
export function backfillWindow(from: unknown, to: unknown, now = Date.now()) {
  if (typeof from !== "string" || typeof to !== "string") return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null;
  if (end > now + 5 * 60 * 1000 || end - start > MAX_BACKFILL_DAYS * DAY_MS) return null;
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}

// One row per session. Active copies go first so a finished copy from the session list wins.
export function storedRows(active: CmsTransaction[], finished: CmsTransaction[], syncedAt: string) {
  const byId = new Map(
    [...active, ...finished].map((t) => {
      const row = toStoredRow(t, syncedAt);
      return [row.transaction_id, row] as const;
    })
  );
  return Array.from(byId.values());
}

type MeterFields = Pick<CmsTransactionRow, "transaction_id" | "energy_kwh" | "start_soc" | "end_soc">;

// ChargeMOD's copy of a session can have energy 0 and no SoC, charging or finished. Keep the
// values the meter readings stored on those rows rather than wiping them on every sync; a
// figure the platform does send wins.
export function keepMeterValues(rows: CmsTransactionRow[], stored: MeterFields[]) {
  const byId = new Map(stored.map((s) => [s.transaction_id, s]));
  return rows.map((row) => {
    const known = byId.get(row.transaction_id);
    if (!known) return row;
    return {
      ...row,
      energy_kwh: (row.energy_kwh ?? 0) > 0 ? row.energy_kwh : known.energy_kwh ?? row.energy_kwh,
      start_soc: row.start_soc ?? known.start_soc,
      end_soc: row.end_soc ?? known.end_soc,
    };
  });
}

// The session columns meter readings fill in: everything while the session is charging,
// only empty columns once it has finished (ChargeMOD's final figures win).
export function meterPatch(
  row: Pick<CmsTransactionRow, "stopped_at" | "energy_kwh" | "start_soc" | "end_soc">,
  metrics: MeterResult["metrics"]
) {
  const charging = !row.stopped_at;
  const patch: Partial<CmsTransactionRow> = {};
  if (metrics.kwhDelivered != null && metrics.kwhDelivered > 0 && (charging || !((row.energy_kwh ?? 0) > 0))) {
    patch.energy_kwh = Math.round(metrics.kwhDelivered * 10000) / 10000;
  }
  if (metrics.startSoc != null && row.start_soc == null) patch.start_soc = metrics.startSoc;
  if (metrics.currentSoc != null && (charging || row.end_soc == null)) patch.end_soc = metrics.currentSoc;
  return patch;
}

// Upserts by transaction_id in chunks of 500 and stops at the first failed chunk. Oldest first:
// the delta sync resumes from the newest stored session, so a newer chunk saved ahead of a
// failed older one would leave the older sessions behind for good.
export async function upsertStoredRows(supabase: SupabaseClient, unsorted: CmsTransactionRow[]) {
  let rows = [...unsorted].sort((a, b) => String(a.started_at ?? "").localeCompare(String(b.started_at ?? "")));
  const known: MeterFields[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      .select("transaction_id,energy_kwh,start_soc,end_soc")
      .in("transaction_id", rows.slice(i, i + 200).map((row) => row.transaction_id));
    // Without them a save could wipe stored figures, so nothing is saved this time.
    if (error) return { written: 0, error: `reading stored meter values failed: ${error.message}` };
    known.push(...(data as MeterFields[]));
  }
  rows = keepMeterValues(rows, known);
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from(SESSIONS_TABLE).upsert(chunk, { onConflict: "transaction_id" });
    if (error) return { written, error: error.message };
    written += chunk.length;
  }
  return { written, error: null };
}

// Stores a session's latest meter readings on its row, and the Energy/SoC they give (see
// meterPatch). Returns an error message, or null when saved; an update RLS refuses changes no
// rows without an error, so that counts as failed too.
export async function saveMeterReadings(supabase: SupabaseClient, transactionId: string, meter: MeterResult) {
  const { data: row, error: readError } = await supabase
    .from(SESSIONS_TABLE)
    .select("stopped_at,energy_kwh,start_soc,end_soc")
    .eq("transaction_id", transactionId)
    .maybeSingle();
  if (readError) return readError.message;
  if (!row) return "session is not stored yet";
  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .update({
      ...meterPatch(row, meter.metrics),
      meter_values_response: scrubRawPayload(meter.payload),
      meter_values_readings: meter.readings,
      current_soc: meter.metrics.currentSoc,
      meter_values_last_reading_at: meter.metrics.lastReadingAt,
      meter_values_fetched_at: new Date().toISOString(),
    })
    .eq("transaction_id", transactionId)
    .select("transaction_id");
  if (error) return error.message;
  return data?.length ? null : "no row was updated";
}

// Sessions can't stay active for days, so a stored session with no stop time that started
// this long before the newest one is treated as stuck and no longer holds the sync back.
export const MAX_ACTIVE_MS = 2 * 24 * 60 * 60 * 1000;

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// transaction_id is the primary key, so an empty transactionId is stored as id.
export function toStoredRow(transaction: CmsTransaction, syncedAt: string): CmsTransactionRow {
  const row = {
    ...Object.fromEntries(Object.entries(transaction).map(([key, value]) => [toSnake(key), value])),
    transaction_id: transaction.transactionId || transaction.id,
    synced_at: syncedAt,
  } as CmsTransactionRow;
  // The site as text, so a platform with non-numeric site ids can be stored (see migration 20261102000100).
  return { ...row, site_id: transaction.locationId == null ? null : String(transaction.locationId) } as CmsTransactionRow & { site_id: string | null };
}

export function fromStoredRow(row: CmsTransactionRow): CmsTransaction {
  // synced_at and site_id are bookkeeping for the table, not part of a session.
  const entries = Object.entries(row).filter(([key]) => key !== "synced_at" && key !== "site_id");
  return Object.fromEntries(entries.map(([key, value]) => [toCamel(key), value])) as CmsTransaction;
}

// Where the ChargeMOD fetch starts: the whole window when nothing is stored yet; otherwise
// the newest stored session's start, or the oldest still-charging stored session's start
// when that is earlier (so it gets its final values). Starts SYNC_OVERLAP_MS early, since
// ChargeMOD leaves out a session that starts exactly at startDate (re-saving one is harmless).
// Never before the window itself.
const SYNC_OVERLAP_MS = 60 * 1000;

// The start of the history the dashboard loads.
export const CMS_HISTORY_START = "2026-07-06T00:00:00+05:30";
// A browser clock a little behind the server's still counts as "through now".
const WINDOW_END_TOLERANCE_MS = 5 * 60 * 1000;

// Saving a session can move the delta sync's resume point (the newest stored session), and
// nothing before that point is fetched again. So only a fetch that joins up with what is stored
// and runs through now may save: a search, a later page, a window starting after the newest
// stored session or ending in the past would leave a hole that is never filled.
export function fetchMayMoveResumePoint(fetch: {
  windowStart: string;
  windowEnd: string;
  page: number;
  searchKey: string;
  newestStoredStart: string | null | undefined;
  now?: number;
}) {
  if (fetch.searchKey || fetch.page !== 1) return false;
  if (Date.parse(fetch.windowEnd) < (fetch.now ?? Date.now()) - WINDOW_END_TOLERANCE_MS) return false;
  return Date.parse(fetch.windowStart) <= Date.parse(fetch.newestStoredStart ?? CMS_HISTORY_START);
}

// Where a platform's stored sessions stand: its newest session, and its oldest still charging.
// Read with the secret-key client: this is a fact about the whole table, and a station-limited
// investor's own client would only see their stations' newest row.
export async function readResumePoint(writer: SupabaseClient, provider: string) {
  const latestStart = (open: boolean) => {
    let query = writer
      .from(SESSIONS_TABLE)
      .select("started_at")
      .eq("provider", provider)
      .not("started_at", "is", null);
    // Only open sessions from the last MAX_ACTIVE_MS: an older one is a platform ghost and,
    // as the oldest, would hide the real ones still waiting for their stop time.
    if (open) query = query.is("stopped_at", null).gte("started_at", new Date(Date.now() - MAX_ACTIVE_MS).toISOString());
    return query.order("started_at", { ascending: open }).limit(1).maybeSingle();
  };
  const [newest, oldestOpen] = await Promise.all([latestStart(false), latestStart(true)]);
  return {
    newest: (newest.data?.started_at as string | undefined) ?? null,
    oldestOpen: (oldestOpen.data?.started_at as string | undefined) ?? null,
    error: (newest.error ?? oldestOpen.error)?.message ?? null,
  };
}

// A charger that was offline uploads its sessions late, with start times before the newest
// stored one, where the delta sync never looks. The scheduled sync therefore always re-reads
// this far back; re-saving a session is harmless.
const SCHEDULED_LOOKBACK_MS = 48 * 60 * 60 * 1000;

export function scheduledSyncStart(newestStoredStart: string | null, oldestOpenStart: string | null, now = Date.now()) {
  const history = new Date(CMS_HISTORY_START).toISOString();
  const resume = syncStartDate(history, newestStoredStart, oldestOpenStart);
  return new Date(Math.min(Date.parse(resume), now - SCHEDULED_LOOKBACK_MS)).toISOString();
}

export function syncStartDate(
  windowStart: string,
  newestStoredStart: string | null | undefined,
  oldestOpenStart?: string | null
) {
  if (!newestStoredStart) return windowStart;
  let start = new Date(newestStoredStart).getTime();
  if (oldestOpenStart) {
    const open = new Date(oldestOpenStart).getTime();
    if (open < start && start - open <= MAX_ACTIVE_MS) start = open;
  }
  start -= SYNC_OVERLAP_MS;
  return start > new Date(windowStart).getTime() ? new Date(start).toISOString() : windowStart;
}

// The platform locations (provider|location_id, as stationLocationKey builds them) of the given
// stations: what a station-limited investor may see.
export async function stationLocationKeys(supabase: SupabaseClient, stationIds: string[]) {
  // A record stands for its whole station: every record with the same name (one per platform).
  const { data, error } = await supabase.from("billing_invoice_stations").select("id, name, provider, location_id");
  if (error) throw new Error(`Station locations could not be read: ${error.message}`);
  const names = new Set((data ?? []).filter((s) => stationIds.includes(s.id)).map((s) => s.name));
  return new Set((data ?? []).filter((s) => names.has(s.name) && s.provider && s.location_id).map((s) => `${s.provider}|${s.location_id}`));
}

// The original platform payload kept with a session (`raw`), with anything secret or personal
// removed: the customer's ChargeMOD tokens (employeeDetails) and any key that looks like a
// credential. Nested objects are cleaned too, to a fixed depth.
const SECRET_KEY = /token|password|secret|authorization|fcm|refresh|employeedetails|apikey|api_key/i;
const MAX_RAW_DEPTH = 6;

export function scrubRawPayload(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_RAW_DEPTH) return null;
  if (Array.isArray(value)) return value.map((item) => scrubRawPayload(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, item]) => [key, scrubRawPayload(item, depth + 1)])
  );
}

// What Overview needs, for an admin without the CMS module: an allowlist, so a column added
// later stays hidden from them until it is added here.
const OVERVIEW_COLUMN_LIST = ["provider", "transaction_id", "id", "location", "location_id", "charger_id", "connector_id", "charger_name", "station_type", "started_at", "stopped_at", "energy_kwh", "tariff_amount"];
export const OVERVIEW_COLUMNS = OVERVIEW_COLUMN_LIST.join(",");

export function withoutCustomerData(transaction: CmsTransaction) {
  const fields = OVERVIEW_COLUMN_LIST.map(toCamel);
  return Object.fromEntries(Object.entries(transaction).filter(([key]) => fields.includes(key))) as CmsTransaction;
}

// The session as the browser gets it: the stored `raw` payload stays on the server.
export function withoutRaw<T extends { raw?: unknown }>(transaction: T): Omit<T, "raw"> {
  const copy = { ...transaction };
  delete copy.raw;
  return copy;
}
