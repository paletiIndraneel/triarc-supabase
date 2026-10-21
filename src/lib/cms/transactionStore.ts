// Pure helpers for the cms_transactions table (migration 20261016000700): column mapping
// and the delta-sync start. Only type imports, so tests/ can load this file directly.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CmsTransaction, CmsTransactionRow } from "./types";
import type { MeterResult } from "./provider";

// ChargeMOD joins first and last name itself and sends "Guest User undefined" when a part
// is missing. Drops "undefined"/"null" words and extra spaces; "Unknown" when nothing is left.
export function cleanUserName(value: unknown) {
  const name = String(value ?? "").split(/\s+/).filter((word) => word && !/^(undefined|null)$/i.test(word)).join(" ");
  return name || "Unknown";
}

const DAY_MS = 24 * 60 * 60 * 1000;
// A billing cycle is at most 16 days (16th to the 31st).
const MAX_BACKFILL_DAYS = 16;

// The history backfill button covers the previous billing cycle (IST): pressed on the
// 16th–month end it is the 1st–15th of this month; on the 1st–15th, the 16th–end of last month.
// `to` is exclusive.
export function previousBillingCycle(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const [year, month, day] = [get("year"), get("month"), get("day")];
  const istMidnight = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d) - 330 * 60 * 1000).toISOString();
  return day >= 16
    ? { from: istMidnight(year, month, 1), to: istMidnight(year, month, 16) }
    : { from: istMidnight(year, month - 1, 16), to: istMidnight(year, month, 1) };
}

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

// ChargeMOD's copy of a session still charging often has energy 0 and no SoC. Keep the
// values the meter readings stored on those rows rather than wiping them on every sync.
export function keepMeterValues(rows: CmsTransactionRow[], stored: MeterFields[]) {
  const byId = new Map(stored.map((s) => [s.transaction_id, s]));
  return rows.map((row) => {
    const known = byId.get(row.transaction_id);
    if (row.stopped_at || !known) return row;
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

// Upserts by transaction_id in chunks of 500 and stops at the first failed chunk.
export async function upsertStoredRows(supabase: SupabaseClient, rows: CmsTransactionRow[]) {
  const openIds = rows.filter((row) => !row.stopped_at).map((row) => row.transaction_id);
  if (openIds.length) {
    const { data, error } = await supabase
      .from("cms_transactions")
      .select("transaction_id,energy_kwh,start_soc,end_soc")
      .in("transaction_id", openIds);
    if (error) console.error("[cms] reading stored meter values failed:", error.message);
    else rows = keepMeterValues(rows, data as MeterFields[]);
  }
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("cms_transactions").upsert(chunk, { onConflict: "transaction_id" });
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
    .from("cms_transactions")
    .select("stopped_at,energy_kwh,start_soc,end_soc")
    .eq("transaction_id", transactionId)
    .maybeSingle();
  if (readError) return readError.message;
  if (!row) return "session is not stored yet";
  const { data, error } = await supabase
    .from("cms_transactions")
    .update({
      ...meterPatch(row, meter.metrics),
      meter_values_response: meter.payload,
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
  return {
    ...Object.fromEntries(Object.entries(transaction).map(([key, value]) => [toSnake(key), value])),
    transaction_id: transaction.transactionId || transaction.id,
    synced_at: syncedAt,
  } as CmsTransactionRow;
}

export function fromStoredRow(row: CmsTransactionRow): CmsTransaction {
  const { synced_at: _syncedAt, ...rest } = row;
  return Object.fromEntries(Object.entries(rest).map(([key, value]) => [toCamel(key), value])) as CmsTransaction;
}

// Where the ChargeMOD fetch starts: the whole window when nothing is stored yet; otherwise
// the newest stored session's start, or the oldest still-charging stored session's start
// when that is earlier (so it gets its final values). Starts SYNC_OVERLAP_MS early, since
// ChargeMOD leaves out a session that starts exactly at startDate (re-saving one is harmless).
// Never before the window itself.
const SYNC_OVERLAP_MS = 60 * 1000;

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
