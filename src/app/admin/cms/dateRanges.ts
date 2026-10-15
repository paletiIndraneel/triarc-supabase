export type DatePreset =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month";

export function getISTCalendarParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

// now is injectable for tests.
export function getDateRangeIST(preset: DatePreset, now = new Date()) {
  // Work on IST calendar parts: an IST midnight Date read back with getUTC*/getDay
  // falls on the previous UTC day, which put the 1st of the month in the prior month.
  const { year, month, day: dayOfMonth } = getISTCalendarParts(now);
  const istMidnight = (offsetDays: number, dayInMonth = dayOfMonth + offsetDays) =>
    new Date(Date.UTC(year, month - 1, dayInMonth) - 330 * 60 * 1000);
  const day = 24 * 60 * 60 * 1000;
  const today = istMidnight(0);
  const weekday = (new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay() + 6) % 7;
  const startOfWeek = istMidnight(-weekday);
  const startOfLastWeek = istMidnight(-weekday - 7);
  const startOfMonth = istMidnight(0, 1);
  // Date.UTC rolls month 0 back to December of the previous year.
  const startOfLastMonth = new Date(Date.UTC(year, month - 2, 1) - 330 * 60 * 1000);

  switch (preset) {
    case "yesterday":
      return {
        startDate: new Date(today.getTime() - day).toISOString(),
        endDate: today.toISOString(),
      };
    case "this-week":
      return {
        startDate: startOfWeek.toISOString(),
        endDate: new Date(today.getTime() + day).toISOString(),
      };
    case "last-week":
      return {
        startDate: startOfLastWeek.toISOString(),
        endDate: startOfWeek.toISOString(),
      };
    case "this-month":
      return {
        startDate: startOfMonth.toISOString(),
        endDate: new Date(today.getTime() + day).toISOString(),
      };
    case "last-month":
      return {
        startDate: startOfLastMonth.toISOString(),
        endDate: startOfMonth.toISOString(),
      };
    case "today":
    default:
      return {
        startDate: today.toISOString(),
        endDate: now.toISOString(),
      };
  }
}

// "YYYY-MM-DD" of the IST calendar day, the format <input type="date"> uses.
export function istDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

// Inclusive IST calendar days from..to; a reversed pair is swapped.
export function getCustomRangeIST(from: string, to: string) {
  const [first, last] = from <= to ? [from, to] : [to, from];
  const start = new Date(`${first}T00:00:00+05:30`);
  const end = new Date(new Date(`${last}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}
