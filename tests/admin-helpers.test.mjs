// Unit tests for the admin's pure helpers. Run with `npm test` (Node's built-in runner).
import test from "node:test";
import assert from "node:assert/strict";
import { calc, gstinError, mergeLines, words } from "../src/app/admin/billing/invoiceMath.mjs";
import { getCustomRangeIST, getDateRangeIST } from "../src/app/admin/cms/dateRanges.ts";
import { getSafeCallbackUrl } from "../src/lib/security.ts";
import { fromStoredRow, syncStartDate, toStoredRow } from "../src/lib/cms/transactionStore.ts";
import { EMPTY_TRANSACTION_FILTERS, isCpoTransaction, matchesTransactionFilters } from "../src/app/admin/cms/transactionFilters.ts";

const item = (quantity, unit_price, gst_rate = 18, discount_percent = 0) => ({ quantity, unit_price, gst_rate, discount_percent });

test("calc splits GST into CGST+SGST within Telangana", () => {
  const t = calc([item(100, 20)], "CGST_SGST");
  assert.equal(t.taxable, 2000);
  assert.equal(t.cgst, 180);
  assert.equal(t.sgst, 180);
  assert.equal(t.igst, 0);
  assert.equal(t.total, 2360);
});

test("calc charges IGST outside Telangana", () => {
  const t = calc([item(100, 20)], "IGST");
  assert.equal(t.igst, 360);
  assert.equal(t.cgst + t.sgst, 0);
  assert.equal(t.total, 2360);
});

test("calc applies discounts before tax and rounds the total to the rupee", () => {
  const t = calc([item(10.5, 19.99, 18, 10), item(3, 7.33)], "CGST_SGST");
  const taxable = 10.5 * 19.99 * 0.9 + 3 * 7.33;
  assert.ok(Math.abs(t.taxable - taxable) < 1e-9);
  assert.equal(t.rows[0].discount_amount, 10.5 * 19.99 * 0.1);
  assert.equal(t.total, Math.round(taxable * 1.18));
  assert.ok(Math.abs(t.round) <= 0.5);
});

test("words reads rupees and paise", () => {
  assert.equal(words(0), "INR Zero Rupees Only");
  assert.equal(words(2360), "INR Two Thousand Three Hundred Sixty Rupees Only");
  assert.equal(words(1234567.5), "INR Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only");
  assert.equal(words(25000000), "INR Two Crore Fifty Lakh Rupees Only");
});

test("words never prints 100 paise", () => {
  assert.equal(words(12.999), "INR Thirteen Rupees Only");
  assert.doesNotMatch(words(12.995), /Hundred Paise/);
});

const ist = (iso) => new Date(iso);
const at = (preset, now) => {
  const r = getDateRangeIST(preset, ist(now));
  return [r.startDate, r.endDate];
};

test("this month starts on the 1st IST, including just after midnight on the 1st", () => {
  assert.equal(at("this-month", "2026-10-01T00:10:00+05:30")[0], "2026-09-30T18:30:00.000Z");
  assert.equal(at("this-month", "2026-10-14T13:00:00+05:30")[0], "2026-09-30T18:30:00.000Z");
  assert.equal(at("this-month", "2026-01-01T02:00:00+05:30")[0], "2025-12-31T18:30:00.000Z");
});

test("weeks start on Monday IST", () => {
  // 2026-10-19 is a Monday; 00:30 IST is still Sunday in UTC.
  assert.deepEqual(at("this-week", "2026-10-19T00:30:00+05:30")[0], "2026-10-18T18:30:00.000Z");
  assert.deepEqual(at("last-week", "2026-10-19T00:30:00+05:30"), ["2026-10-11T18:30:00.000Z", "2026-10-18T18:30:00.000Z"]);
  assert.equal(at("this-week", "2026-10-14T13:00:00+05:30")[0], "2026-10-11T18:30:00.000Z");
});

test("today and yesterday follow the IST calendar day", () => {
  assert.deepEqual(at("today", "2026-10-01T00:10:00+05:30"), ["2026-09-30T18:30:00.000Z", "2026-09-30T18:40:00.000Z"]);
  assert.deepEqual(at("yesterday", "2026-10-01T00:10:00+05:30"), ["2026-09-29T18:30:00.000Z", "2026-09-30T18:30:00.000Z"]);
});

test("getSafeCallbackUrl keeps same-origin paths and blocks dot-segment redirects", () => {
  const origin = "https://site.example";
  assert.equal(getSafeCallbackUrl("/admin?tab=cms#x", origin), "/admin?tab=cms#x");
  assert.equal(getSafeCallbackUrl("/admin/../signin", origin), "/signin");
  for (const raw of ["//evil.example", "/..//evil.example", "/.//evil.example", "/admin/..//evil.example", "/admin/%2e%2e//evil.example", "/%2e//evil.example"]) {
    assert.equal(getSafeCallbackUrl(raw, origin), "/admin", raw);
  }
});

test("last month spans the previous IST calendar month, across a year boundary", () => {
  assert.deepEqual(at("last-month", "2026-10-15T12:00:00+05:30"), ["2026-08-31T18:30:00.000Z", "2026-09-30T18:30:00.000Z"]);
  assert.deepEqual(at("last-month", "2026-01-01T00:10:00+05:30"), ["2025-11-30T18:30:00.000Z", "2025-12-31T18:30:00.000Z"]);
});

test("transaction filters match location, AC/DC, status, min kWh and search", () => {
  const row = {
    id: "1", transactionId: "TX-9", chargerId: "C1", chargerName: "Bay 2 DC Charger", stationType: null,
    location: "Bhadrachalam", type: null, userName: "Ravi", mobile: "9876543210", vehicleNumber: "TS09AB1234", energyKwh: 0,
  };
  const f = (over) => ({ ...EMPTY_TRANSACTION_FILTERS, ...over });
  assert.equal(matchesTransactionFilters(row, f({}), false, new Set()), true);
  assert.equal(matchesTransactionFilters(row, f({ location: "Other" }), false, new Set()), false);
  assert.equal(matchesTransactionFilters(row, f({ current: "dc" }), false, new Set()), true);
  assert.equal(matchesTransactionFilters(row, f({ current: "ac" }), false, new Set()), false);
  assert.equal(matchesTransactionFilters(row, f({ status: "failed" }), false, new Set()), true);
  assert.equal(matchesTransactionFilters(row, f({ status: "live" }), true, new Set()), true);
  assert.equal(matchesTransactionFilters(row, f({ minKwh: "0.5" }), false, new Set()), false);
  assert.equal(matchesTransactionFilters(row, f({ search: "ts09ab" }), false, new Set()), true);
  assert.equal(matchesTransactionFilters(row, f({ search: "nobody" }), false, new Set()), false);
});

test("custom range covers whole IST days inclusive, swapping a reversed pair", () => {
  const expected = { startDate: "2026-09-30T18:30:00.000Z", endDate: "2026-10-05T18:30:00.000Z" };
  assert.deepEqual(getCustomRangeIST("2026-10-01", "2026-10-05"), expected);
  assert.deepEqual(getCustomRangeIST("2026-10-05", "2026-10-01"), expected);
});

test("CPO rule: ChargeMOD type wins, else a CPO Settings mobile in any format matches", () => {
  const cpo = new Set(["9876543210"]);
  const row = (type, mobile) => ({ type, mobile });
  assert.equal(isCpoTransaction(row("CPO", null), cpo), true);
  assert.equal(isCpoTransaction(row("PUBLIC", "9876543210"), cpo), false);
  assert.equal(isCpoTransaction(row(null, "+91 98765-43210"), cpo), true);
  assert.equal(isCpoTransaction(row("", "9000000000"), cpo), false);
  const f = { ...EMPTY_TRANSACTION_FILTERS, customer: "regular" };
  assert.equal(matchesTransactionFilters({ ...row("CPO", null), energyKwh: 1 }, f, false, cpo), false);
});

test("gstinError accepts a valid GSTIN and rejects bad format or check digit", () => {
  assert.equal(gstinError("36AAYFT2036P1ZB"), null);
  assert.match(gstinError("23ASDASDASDASDA"), /look like/);
  assert.match(gstinError("36AAYFT2036P1ZC"), /check digit/);
});

test("mergeLines adds quantities of identical item lines and keeps different rates apart", () => {
  const line = (inventory_id, quantity, unit_price) => ({ inventory_id, description: "AC", hsn: "996749", unit: "KWH", quantity, unit_price, gst_rate: 18 });
  const merged = mergeLines([line("a", 1, 15), line("a", "0.1", 15), line("a", 0.2, 15), line("a", 2, 16)]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].quantity, 1.3);
  assert.equal(merged[1].quantity, 2);
  assert.equal(calc(merged, "IGST").total, calc([line("a", 1.3, 15), line("a", 2, 16)], "IGST").total);
});

test("investors can open only the CMS dashboard and enquiries; partners open every module", async () => {
  const { canOpenModule } = await import("../src/components/admin/adminNavigation.ts");
  assert.deepEqual(["cms", "billing", "enquiries", "cpo-settings"].map((m) => canOpenModule(m, false)), [true, false, true, false]);
  assert.ok(["cms", "billing", "enquiries", "cpo-settings"].every((m) => canOpenModule(m, true)));
});

test("overviewMetrics totals today, month-to-date and the same days last month in IST", async () => {
  const { overviewMetrics } = await import("../src/app/admin/overview/overviewMetrics.ts");
  const now = new Date("2026-10-16T10:00:00+05:30");
  const row = (startedAt, energyKwh, tariffAmount) => ({ startedAt, energyKwh, tariffAmount });
  const m = overviewMetrics([
    row("2026-10-16T00:10:00+05:30", 10, 200),   // today
    row("2026-10-15T23:50:00+05:30", 5, 100),    // yesterday in IST, same UTC date as today
    row("2026-10-01T00:00:00+05:30", -3, 50),    // negative reading counts as 0 kWh
    row("2026-09-16T09:00:00+05:30", 7, 70),     // last month, inside 1st–16th 10:00
    row("2026-09-16T11:00:00+05:30", 7, 999),    // last month, after the same time of day
    row(null, 99, 99),
  ], now);
  assert.deepEqual(m.today, { label: "16 Oct", kwh: 10, revenue: 200, sessions: 1 });
  assert.deepEqual(m.monthToDate, { kwh: 15, revenue: 350, sessions: 3 });
  assert.equal(m.lastMonthSameDaysRevenue, 70);
  assert.equal(m.days.length, 30);
  assert.equal(m.days[0].label, "17 Sept");
  assert.equal(m.days[28].kwh, 5);
});

test("cms_transactions rows round-trip camelCase fields through snake_case columns", () => {
  const t = { id: "m1", transactionId: "", energyKwh: 4.026, startedAt: "2026-09-01T01:42:01.899Z", isTimeBasedTariff: false };
  const row = toStoredRow(t, "2026-10-16T00:00:00.000Z");
  assert.equal(row.transaction_id, "m1");
  assert.equal(row.energy_kwh, 4.026);
  assert.equal(row.is_time_based_tariff, false);
  // transaction_id is the primary key, so an empty transactionId is stored (and read back) as id.
  assert.deepEqual(fromStoredRow(row), { ...t, transactionId: "m1" });
});

test("delta sync starts at the newest stored session, or the oldest one still charging", () => {
  const windowStart = "2026-08-31T18:30:00.000Z";
  const newest = "2026-10-16T10:00:00.000Z";
  assert.equal(syncStartDate(windowStart, null), windowStart);
  assert.equal(syncStartDate(windowStart, newest), newest);
  assert.equal(syncStartDate(windowStart, newest, "2026-10-16T08:00:00.000Z"), "2026-10-16T08:00:00.000Z");
  // a session "charging" for more than 2 days is stuck and doesn't hold the sync back
  assert.equal(syncStartDate(windowStart, newest, "2026-10-10T08:00:00.000Z"), newest);
  assert.equal(syncStartDate(windowStart, "2026-08-01T00:00:00.000Z"), windowStart);
});
