// The one definition of a billing cycle. Everything that shows or sums a cycle — the Overview
// cards, the CMS period matrix and its older cycles, the history backfill window — asks here,
// so changing a platform's billing runs through this file and nothing else.
//
// Pure on purpose: no imports, so the test runner can load it, and no Date mutation, so every
// boundary is an epoch millisecond in IST.
//
// ChargeMOD billed in half-months, which is where "1–15 / 16–end" came from. Ionage bills every
// 7 days: add it to PROVIDER_CYCLES as { kind: "days", length: 7, anchor: "YYYY-MM-DD" }, the IST
// date its first cycle began, and point DEFAULT_CYCLE at it on the cutover.

export type CycleRule =
  | { kind: "half-month" }
  | { kind: "days"; length: number; anchor: string }; // anchor: "YYYY-MM-DD", IST

// A cycle belongs to a charging platform, not to Triarc: ChargeMOD billed in half-months, Ionage
// bills every 7 days, and Ather may do something else again. Key by the provider ids in
// cms/providerIds.ts; anything not listed falls back to DEFAULT_CYCLE.
export const PROVIDER_CYCLES: Record<string, CycleRule> = {
  chargemod: { kind: "half-month" },
};

// The rule for figures that are not tied to one platform (the Overview cards, the CMS matrix when
// no platform is selected). Point it at whichever platform the business runs on.
export const DEFAULT_CYCLE: CycleRule = { kind: "half-month" };

export function cycleRuleFor(provider?: string | null): CycleRule {
  return (provider && PROVIDER_CYCLES[provider]) || DEFAULT_CYCLE;
}

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const IST_OFFSET = 330 * MINUTE;

// Midnight IST as epoch ms. Out-of-range month/day values roll over, so month 13 and day 32 work.
export function istMidnight(year: number, month: number, day: number) {
  return Date.UTC(year, month - 1, day) - IST_OFFSET;
}

// The IST calendar date of an instant.
export function istParts(at: Date | number) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
    .format(new Date(at))
    .split("-")
    .map(Number);
  return { year, month, day };
}

// A cycle's half-open range: start inclusive, end exclusive.
export type Cycle = { start: number; end: number };

export function cycleContaining(at: Date | number, rule: CycleRule = DEFAULT_CYCLE): Cycle {
  const { year, month, day } = istParts(at);
  if (rule.kind === "half-month") {
    return day > 15
      ? { start: istMidnight(year, month, 16), end: istMidnight(year, month + 1, 1) }
      : { start: istMidnight(year, month, 1), end: istMidnight(year, month, 16) };
  }
  const [anchorYear, anchorMonth, anchorDay] = rule.anchor.split("-").map(Number);
  const anchor = istMidnight(anchorYear, anchorMonth, anchorDay);
  const span = rule.length * DAY;
  // Floor division, so dates before the anchor land in earlier cycles rather than the first one.
  const index = Math.floor((istMidnight(year, month, day) - anchor) / span);
  return { start: anchor + index * span, end: anchor + (index + 1) * span };
}

// The cycle before the one holding `at`.
export function previousCycle(at: Date | number, rule: CycleRule = DEFAULT_CYCLE): Cycle {
  return cycleContaining(cycleContaining(at, rule).start - 1, rule);
}

// `count` cycles ending with the one holding `at`, oldest first.
export function cyclesBack(at: Date | number, count: number, rule: CycleRule = DEFAULT_CYCLE): Cycle[] {
  const cycles: Cycle[] = [];
  let cycle = cycleContaining(at, rule);
  for (let i = 0; i < count; i += 1) {
    cycles.unshift(cycle);
    cycle = cycleContaining(cycle.start - 1, rule);
  }
  return cycles;
}

// What the current cycle is compared against on the Overview: the same half a month earlier, or
// for a run of days whichever cycle was running a month ago.
export function comparisonCycle(at: Date | number, rule: CycleRule = DEFAULT_CYCLE): Cycle {
  if (rule.kind === "half-month") {
    const { year, month, day } = istParts(at);
    return cycleContaining(istMidnight(year, month - 1, day > 15 ? 16 : 1), rule);
  }
  return cycleContaining(cycleContaining(at, rule).start - 30 * DAY, rule);
}

// The longest a cycle can run, for the backfill window's sanity check: a half-month cycle is at
// most 16 days (16th to the 31st).
export function maxCycleDays(rule: CycleRule = DEFAULT_CYCLE) {
  return rule.kind === "half-month" ? 16 : rule.length;
}

const SHORT_MONTH = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "short" });
const SHORT_DATE = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

// "Sep 1–15" / "Sep 16–end" for half-months, "20–26 Sep" for a run of days. `end` is exclusive,
// so the label names the last day inside the cycle.
export function cycleLabel(cycle: Cycle, rule: CycleRule = DEFAULT_CYCLE) {
  const month = SHORT_MONTH.format(new Date(cycle.start)).slice(0, 3);
  if (rule.kind === "half-month") {
    return `${month} ${istParts(cycle.start).day > 15 ? "16–end" : "1–15"}`;
  }
  return `${SHORT_DATE.format(new Date(cycle.start))} – ${SHORT_DATE.format(new Date(cycle.end - 1))}`;
}

// The history backfill button covers the previous cycle, as ISO strings; `to` is exclusive.
export function previousBillingCycle(now: Date = new Date(), rule: CycleRule = DEFAULT_CYCLE) {
  const { start, end } = previousCycle(now, rule);
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}
