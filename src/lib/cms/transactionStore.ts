// Pure helpers for the cms_transactions table (migration 20261016000700): column mapping
// and the delta-sync window. No imports, so tests/ can load this file directly.

// Sessions can't stay active for days, so every sync re-fetches this far back from the
// newest stored session; sessions saved while still charging get their final values.
export const RESYNC_OVERLAP_MS = 3 * 24 * 60 * 60 * 1000;

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// A sanitized transaction as a table row. A new sanitizeTransaction field needs a matching column.
export function toStoredRow(transaction: Record<string, unknown>, syncedAt: string) {
  return {
    ...Object.fromEntries(Object.entries(transaction).map(([key, value]) => [toSnake(key), value])),
    transaction_id: String(transaction.transactionId || transaction.id),
    synced_at: syncedAt,
  };
}

export function fromStoredRow(row: Record<string, unknown>) {
  const { synced_at: _syncedAt, ...rest } = row;
  return Object.fromEntries(Object.entries(rest).map(([key, value]) => [toCamel(key), value]));
}

// Where the ChargeMOD fetch starts: the whole window when nothing is stored yet, otherwise
// RESYNC_OVERLAP_MS before the newest stored session (never before the window itself).
export function syncStartDate(windowStart: string, newestStoredStart: string | null | undefined) {
  if (!newestStoredStart) return windowStart;
  const overlapStart = new Date(newestStoredStart).getTime() - RESYNC_OVERLAP_MS;
  return overlapStart > new Date(windowStart).getTime() ? new Date(overlapStart).toISOString() : windowStart;
}
