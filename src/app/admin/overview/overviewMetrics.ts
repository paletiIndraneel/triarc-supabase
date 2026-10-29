type Row = { startedAt: string | null; energyKwh: number | null; tariffAmount: number | null };
export type DayTotal = { label: string; kwh: number; revenue: number; sessions: number };

// A billing cycle's half-open range in epoch ms, as @/lib/billingCycle builds it.
type Cycle = { start: number; end: number };
// The cycles the cards cover: the current one, the two before it, and what the current one is
// compared against. The caller works them out with @/lib/billingCycle, so this file never decides
// what a cycle is — it only sums rows over the ranges it is handed.
export type OverviewCycles = { current: Cycle; previous: Cycle; older: Cycle; comparison: Cycle };

const MINUTE = 60 * 1000;

// Overview figures from CMS transactions, by session start in IST. Sums match the CMS
// dashboard: energy ignores non-positive readings, revenue counts every finite amount.
export function overviewMetrics(rows: Row[], now: Date, cycles: OverviewCycles) {
  // No import of dateRanges.ts or billingCycle.ts: Node's test runner needs the .ts extension,
  // Next's TS config rejects it. Only type imports here.
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now).split("-").map(Number);
  const istMidnight = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) - 330 * MINUTE;
  const sum = (start: number, end: number) => {
    const total = { kwh: 0, revenue: 0, sessions: 0 };
    for (const row of rows) {
      const t = row.startedAt ? new Date(row.startedAt).getTime() : NaN;
      if (!(t >= start && t < end)) continue;
      total.sessions += 1;
      total.kwh += Math.max(0, Number(row.energyKwh) || 0);
      const amount = Number(row.tariffAmount);
      if (row.tariffAmount != null && Number.isFinite(amount)) total.revenue += amount;
    }
    return total;
  };

  const nowMs = now.getTime();
  const { current, previous, older, comparison } = cycles;
  // The cycle it is compared against, up to the same point into it (capped at that cycle's end).
  const comparisonSameDays = sum(comparison.start, Math.min(comparison.start + (nowMs - current.start) + 1, comparison.end));

  const label = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
  const days: DayTotal[] = [];
  for (let back = 29; back >= 0; back -= 1) {
    const start = istMidnight(year, month, day - back);
    days.push({ label: label.format(new Date(start + 330 * MINUTE)), ...sum(start, start + 24 * 60 * MINUTE) });
  }

  const range = (start: number, end: number) => `${label.format(new Date(start + 330 * MINUTE))}–${label.format(new Date(end - 1))}`;
  // IST calendar dates; `to` is exclusive.
  const ymd = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ms));
  const span = (start: number, end: number) => ({ from: ymd(start), to: ymd(end) });

  return {
    today: days[days.length - 1],
    currentCycle: { label: range(current.start, current.end), ...span(current.start, current.end), ...sum(current.start, nowMs + 1) },
    previousCycle: { label: range(previous.start, previous.end), ...span(previous.start, previous.end), ...sum(previous.start, previous.end) },
    olderCycle: { label: range(older.start, older.end), ...span(older.start, older.end), ...sum(older.start, older.end) },
    lastMonthSameDaysRevenue: comparisonSameDays.revenue,
    days,
  };
}
