export type DatePreset =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month";

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
    case "today":
    default:
      return {
        startDate: today.toISOString(),
        endDate: now.toISOString(),
      };
  }
}
