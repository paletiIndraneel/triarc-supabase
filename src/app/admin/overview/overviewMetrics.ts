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
  const DAY = 24 * 60 * MINUTE;
  const todayStart = istMidnight(year, month, day);
  // The last 30 days as two 15-day blocks: today and the 14 days before it, then the 15 before that.
  const recentStart = todayStart - 14 * DAY;
  const earlierStart = recentStart - 15 * DAY;
  // Same dates a month earlier as the recent block, up to the same time of day.
  // shortcut: Date.UTC rolls 29–31 over into the next month (31 Mar -> 3 Mar); fine for a comparison note.
  const lastMonthToday = istMidnight(year, month - 1, day);
  const lastMonthSameDays = sum(lastMonthToday - 14 * DAY, lastMonthToday + (nowMs - todayStart) + 1);

  const label = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
  const days: DayTotal[] = [];
  for (let back = 29; back >= 0; back -= 1) {
    const start = istMidnight(year, month, day - back);
    days.push({ label: label.format(new Date(start + 330 * MINUTE)), ...sum(start, start + 24 * 60 * MINUTE) });
  }

  const range = (start: number, end: number) => `${label.format(new Date(start + 330 * MINUTE))}–${label.format(new Date(end - 1))}`;

  return {
    today: days[days.length - 1],
    recent15Days: { label: range(recentStart, todayStart + DAY), ...sum(recentStart, nowMs + 1) },
    earlier15Days: { label: range(earlierStart, recentStart), ...sum(earlierStart, recentStart) },
    lastMonthSameDaysRevenue: lastMonthSameDays.revenue,
    days,
  };
}
