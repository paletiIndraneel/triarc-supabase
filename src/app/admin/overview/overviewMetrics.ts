type Row = { startedAt: string | null; energyKwh: number | null; tariffAmount: number | null };
export type DayTotal = { label: string; kwh: number; revenue: number; sessions: number };

const MINUTE = 60 * 1000;

// Overview figures from CMS transactions, by session start in IST. Sums match the CMS
// dashboard: energy ignores non-positive readings, revenue counts every finite amount.
export function overviewMetrics(rows: Row[], now = new Date()) {
  // No import of dateRanges.ts: Node's test runner needs the .ts extension, Next's TS config rejects it.
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
  // Billing runs in half-month cycles: 1st–15th and 16th–month end (28–31, whatever the month has).
  // The Overview shows the current one and the two before it (45 days).
  const secondHalf = day > 15;
  const currentStart = istMidnight(year, month, secondHalf ? 16 : 1);
  const currentEnd = secondHalf ? istMidnight(year, month + 1, 1) : istMidnight(year, month, 16);
  const previousStart = secondHalf ? istMidnight(year, month, 1) : istMidnight(year, month - 1, 16);
  const olderStart = secondHalf ? istMidnight(year, month - 1, 16) : istMidnight(year, month - 1, 1);
  // Same cycle last month, up to the same point into it (capped at that cycle's end).
  const lastMonthStart = istMidnight(year, month - 1, secondHalf ? 16 : 1);
  const lastMonthEnd = secondHalf ? istMidnight(year, month, 1) : istMidnight(year, month - 1, 16);
  const lastMonthSameDays = sum(lastMonthStart, Math.min(lastMonthStart + (nowMs - currentStart) + 1, lastMonthEnd));

  const label = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
  const days: DayTotal[] = [];
  for (let back = 29; back >= 0; back -= 1) {
    const start = istMidnight(year, month, day - back);
    days.push({ label: label.format(new Date(start + 330 * MINUTE)), ...sum(start, start + 24 * 60 * MINUTE) });
  }

  const range = (start: number, end: number) => `${label.format(new Date(start + 330 * MINUTE))}–${label.format(new Date(end - 1))}`;

  return {
    today: days[days.length - 1],
    currentCycle: { label: range(currentStart, currentEnd), ...sum(currentStart, nowMs + 1) },
    previousCycle: { label: range(previousStart, currentStart), ...sum(previousStart, currentStart) },
    olderCycle: { label: range(olderStart, previousStart), ...sum(olderStart, previousStart) },
    lastMonthSameDaysRevenue: lastMonthSameDays.revenue,
    days,
  };
}
