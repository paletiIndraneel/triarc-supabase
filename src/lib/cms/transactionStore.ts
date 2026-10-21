// Pure helpers for the cms_transactions table (migration 20261016000700): column mapping
// and the delta-sync start. Only type imports, so tests/ can load this file directly.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CmsTransaction, CmsTransactionRow } from "./types";

// The history backfill button covers this many days back from when it is pressed.
export const HISTORY_BACKFILL_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

// Checks a backfill window sent by the browser: valid ISO times, from < to, not in the
// future and no longer than HISTORY_BACKFILL_DAYS (plus a day of slack). Null when invalid.
export function backfillWindow(from: unknown, to: unknown, now = Date.now()) {
  if (typeof from !== "string" || typeof to !== "string") return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null;
  if (end > now + 5 * 60 * 1000 || end - start > (HISTORY_BACKFILL_DAYS + 1) * DAY_MS) return null;
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

// Upserts by transaction_id in chunks of 500 and stops at the first failed chunk.
export async function upsertStoredRows(supabase: SupabaseClient, rows: CmsTransactionRow[]) {
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("cms_transactions").upsert(chunk, { onConflict: "transaction_id" });
    if (error) return { written, error: error.message };
    written += chunk.length;
  }
  return { written, error: null };
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
// when that is earlier (so it gets its final values). Never before the window itself.
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
  return start > new Date(windowStart).getTime() ? new Date(start).toISOString() : windowStart;
}
