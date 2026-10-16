// Pure helpers for the cms_transactions table (migration 20261016000700): column mapping
// and the delta-sync start. Only type imports, so tests/ can load this file directly.
import type { CmsTransaction, CmsTransactionRow } from "./types";

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
