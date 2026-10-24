// Unit tests for the admin's pure helpers. Run with `npm test` (Node's built-in runner).
import { liveMetrics, parseMeterValues } from "../src/lib/cms/liveMetrics.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { calc, gstinError, mergeLines, rateExGst, words } from "../src/app/admin/billing/invoiceMath.mjs";
import { getCustomRangeIST, getDateRangeIST } from "../src/app/admin/cms/dateRanges.ts";
import { getSafeCallbackUrl } from "../src/lib/security.ts";
import { backfillWindow, cleanUserName, fromStoredRow, keepMeterValues, meterPatch, previousBillingCycle, storedRows, syncStartDate, toStoredRow } from "../src/lib/cms/transactionStore.ts";
import { EMPTY_TRANSACTION_FILTERS, isCpoTransaction, matchesTransactionFilters, shortChargerLabel, splitActiveSessions, isStuckSession } from "../src/app/admin/cms/transactionFilters.ts";

const item = (quantity, unit_price, gst_rate = 18, discount_percent = 0) => ({ quantity, unit_price, gst_rate, discount_percent });

test("calc takes GST out of a GST-inclusive rate, CGST+SGST within Telangana", () => {
  const t = calc([item(100, 23.6)], "CGST_SGST");
  assert.ok(Math.abs(t.taxable - 2000) < 1e-9);
  assert.ok(Math.abs(t.cgst - 180) < 1e-9);
  assert.ok(Math.abs(t.sgst - 180) < 1e-9);
  assert.equal(t.igst, 0);
  assert.equal(t.total, 2360); // quantity x rate: GST is inside the rate, not added on top
  assert.ok(Math.abs(t.rows[0].line_total - 2360) < 1e-9);
});

test("calc charges IGST outside Telangana, still inside the rate", () => {
  const t = calc([item(100, 20)], "IGST");
  assert.ok(Math.abs(t.taxable - 2000 / 1.18) < 1e-9);
  assert.ok(Math.abs(t.igst - (2000 - 2000 / 1.18)) < 1e-9);
  assert.equal(t.cgst + t.sgst, 0);
  assert.equal(t.total, 2000);
});

test("calc applies discounts to the inclusive amount and rounds the total to the rupee", () => {
  const t = calc([item(10.5, 19.99, 18, 10), item(3, 7.33)], "CGST_SGST");
  const incl = 10.5 * 19.99 * 0.9 + 3 * 7.33;
  assert.ok(Math.abs(t.taxable - incl / 1.18) < 1e-9);
  assert.equal(t.rows[0].discount_amount, 10.5 * 19.99 * 0.1);
  assert.equal(t.total, Math.round(incl));
  assert.ok(Math.abs(t.round) <= 0.5);
});

test("rateExGst is the rate the invoice prints: quantity x it = taxable amount", () => {
  assert.ok(Math.abs(rateExGst(23.6, 18) - 20) < 1e-9);
  assert.equal(rateExGst(20, 0), 20);
  const t = calc([item(37.5, 22)], "IGST");
  assert.ok(Math.abs(37.5 * rateExGst(22, 18) - t.rows[0].taxable_amount) < 1e-9);
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
  assert.equal(getSafeCallbackUrl("/?module=cms#x", origin), "/?module=cms#x");
  assert.equal(getSafeCallbackUrl("/x/../signin", origin), "/signin");
  for (const raw of ["//evil.example", "/..//evil.example", "/.//evil.example", "/x/..//evil.example", "/x/%2e%2e//evil.example", "/%2e//evil.example"]) {
    assert.equal(getSafeCallbackUrl(raw, origin), "/", raw);
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
  assert.equal(mergeLines([line("b", 1.2345, 15), line("b", 0.0001, 15)])[0].quantity, 1.2346); // 4 decimals kept
  assert.equal(merged[1].quantity, 2);
  assert.equal(calc(merged, "IGST").total, calc([line("a", 1.3, 15), line("a", 2, 16)], "IGST").total);
});

test("admins open the ticked modules (Access only with full access); full access opens every module", async () => {
  const { canOpenModule } = await import("../src/components/admin/adminNavigation.ts");
  const all = ["overview", "cms", "billing", "enquiries", "stations", "access", "cpo-settings"];
  const investor = ["overview", "cms", "enquiries"];
  assert.deepEqual(all.map((m) => canOpenModule(m, false, investor)), [true, true, false, true, false, false, false]);
  assert.deepEqual(all.map((m) => canOpenModule(m, false, ["billing", "access"])), [true, false, true, false, false, false, false]);
  assert.ok(all.every((m) => canOpenModule(m, true)));
});

test("station records with the same name are one station", async () => {
  const { groupStations } = await import("../src/app/admin/cms/transactionFilters.ts");
  const groups = groupStations([
    { id: "a", name: "Triarc EV hub | Bhadrachalam", active: true, provider: "chargemod", location_id: "1" },
    { id: "m", name: "Mock", active: false, provider: null, location_id: null },
    { id: "b", name: "Triarc EV hub | Bhadrachalam", active: false, provider: "ather", location_id: "x" },
  ]);
  assert.deepEqual(groups.map((g) => [g.name, g.ids, g.active]), [["Triarc EV hub | Bhadrachalam", ["a", "b"], true], ["Mock", ["m"], false]]);
});

test("overviewMetrics totals the current and previous half-month billing cycles in IST", async () => {
  const { overviewMetrics } = await import("../src/app/admin/overview/overviewMetrics.ts");
  const row = (startedAt, energyKwh, tariffAmount) => ({ startedAt, energyKwh, tariffAmount });
  const rows = [
    row("2026-10-16T00:10:00+05:30", 10, 200),   // today
    row("2026-10-15T23:50:00+05:30", 5, 100),    // yesterday in IST, same UTC date as today
    row("2026-10-02T00:00:00+05:30", -3, 50),    // negative reading counts as 0 kWh
    row("2026-10-01T23:59:00+05:30", 4, 40),
    row("2026-09-17T00:00:00+05:30", 6, 60),
    row("2026-09-16T23:00:00+05:30", 9, 90),
    row("2026-09-16T11:00:00+05:30", 7, 999),    // last month's 16th, after 10:00
    row("2026-09-16T09:00:00+05:30", 7, 70),     // last month's 16th, before 10:00
    row("2026-09-01T12:00:00+05:30", 1, 500),
    row(null, 99, 99),
  ];
  // 16th onward: this cycle is 16th–month end, the previous one 1st–15th
  const m = overviewMetrics(rows, new Date("2026-10-16T10:00:00+05:30"));
  assert.deepEqual(m.today, { label: "16 Oct", kwh: 10, revenue: 200, sessions: 1 });
  assert.deepEqual(m.currentCycle, { label: "16 Oct–31 Oct", from: "2026-10-16", to: "2026-11-01", kwh: 10, revenue: 200, sessions: 1 });
  assert.deepEqual(m.previousCycle, { label: "1 Oct–15 Oct", from: "2026-10-01", to: "2026-10-16", kwh: 9, revenue: 190, sessions: 3 });
  assert.deepEqual(m.olderCycle, { label: "16 Sept–30 Sept", from: "2026-09-16", to: "2026-10-01", kwh: 29, revenue: 1219, sessions: 4 });
  assert.equal(m.lastMonthSameDaysRevenue, 70); // 16 Sept up to 10:00
  assert.equal(m.days.length, 30);
  assert.equal(m.days[0].label, "17 Sept");
  assert.equal(m.days[28].kwh, 5);
  // 1st–15th: this cycle is 1st–15th, the previous one 16th–end of last month
  const early = overviewMetrics(rows, new Date("2026-10-05T10:00:00+05:30"));
  assert.deepEqual(early.currentCycle, { label: "1 Oct–15 Oct", from: "2026-10-01", to: "2026-10-16", kwh: 4, revenue: 90, sessions: 2 });
  assert.deepEqual(early.previousCycle, { label: "16 Sept–30 Sept", from: "2026-09-16", to: "2026-10-01", kwh: 29, revenue: 1219, sessions: 4 });
  assert.deepEqual(early.olderCycle, { label: "1 Sept–15 Sept", from: "2026-09-01", to: "2026-09-16", kwh: 1, revenue: 500, sessions: 1 });
  assert.equal(early.lastMonthSameDaysRevenue, 500); // 1 Sept up to 5 Sept 10:00
  // February's second cycle ends on the 28th
  assert.equal(overviewMetrics([], new Date("2027-02-20T10:00:00+05:30")).currentCycle.label, "16 Feb–28 Feb");
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
  // one minute early: ChargeMOD leaves out a session starting exactly at startDate
  assert.equal(syncStartDate(windowStart, newest), "2026-10-16T09:59:00.000Z");
  assert.equal(syncStartDate(windowStart, newest, "2026-10-16T08:00:00.000Z"), "2026-10-16T07:59:00.000Z");
  // a session "charging" for more than 2 days is stuck and doesn't hold the sync back
  assert.equal(syncStartDate(windowStart, newest, "2026-10-10T08:00:00.000Z"), "2026-10-16T09:59:00.000Z");
  assert.equal(syncStartDate(windowStart, "2026-08-31T18:30:30.000Z"), windowStart);
  assert.equal(syncStartDate(windowStart, "2026-08-01T00:00:00.000Z"), windowStart);
});

test("financeMetrics: receivables, aging, GST and FY months", async () => {
  const { financeMetrics, billedInCycle } = await import("../src/app/admin/overview/financeMetrics.ts");
  const inv = (o) => ({ invoice_status: "issued", grand_total: 118, amount_paid: 0, taxable_amount: 100, cgst_amount: 9, sgst_amount: 9, igst_amount: 0, ...o });
  const rows = [
    inv({ invoice_date: "2026-10-10", due_date: "2026-10-20" }),
    inv({ invoice_date: "2026-08-01", invoice_status: "partially_paid", amount_paid: 18, billing_period_to: "2026-10-15" }),
    inv({ invoice_date: "2026-10-02", invoice_status: "paid", amount_paid: 118, cgst_amount: 0, sgst_amount: 0, igst_amount: 18 }),
    inv({ invoice_date: "2026-10-03", invoice_status: "cancelled", grand_total: 999 }),
    inv({ invoice_date: "2026-03-30", invoice_status: "paid", amount_paid: 118 }),
  ];
  const sessions = [{ startedAt: "2026-10-05T04:00:00Z", tariffAmount: 50 }, { startedAt: "2026-09-20T04:00:00Z", tariffAmount: 25 }];
  const f = financeMetrics(rows, sessions, new Date("2026-10-17T10:00:00+05:30"));
  assert.equal(f.fyLabel, "FY 2026-27");
  assert.equal(f.receivable, 218);
  assert.equal(f.openCount, 2);
  assert.equal(f.aging.current, 118);
  assert.equal(f.aging.d90, 100);
  assert.equal(f.billedFy, 354);
  assert.equal(f.collectedFy, 136);
  assert.equal(f.gstMonth.tax, 36);
  assert.equal(f.gstMonth.igst, 18);
  assert.equal(f.months.length, 7);
  assert.equal(f.months.at(-1).billed, 236);
  assert.equal(f.months.at(-1).charging, 50);
  assert.equal(f.months[0].charging, null);
  assert.equal(billedInCycle(rows, "2026-10-01", "2026-10-16"), 118);
});

test("shortChargerLabel names chargers and guns for the Active now card", () => {
  assert.equal(shortChargerLabel("Triarc | DC 60kW CCS-2", "DC", 1), "DC 60kW-1");
  assert.equal(shortChargerLabel("Triarc | DC 60kW CCS-2", "DC", 2), "DC 60kW-2");
  assert.equal(shortChargerLabel("Triarc | DC 120kW CCS-2", "DC", 3), "DC 120kW-3");
  assert.equal(shortChargerLabel("Triarc | AC 3.3kW Socket | A", "AC", 1), "AC 3.3kW-A");
  assert.equal(shortChargerLabel("Triarc | AC 3.3kW Socket | B", "AC", 1), "AC 3.3kW-B");
  assert.equal(shortChargerLabel("Triarc | AC 22kW Type-2", "AC", 1), "22kW");
  assert.equal(shortChargerLabel("Triarc | AC 7.4kW Type-2", "AC", 2), "AC 7.4kW-2");
  assert.equal(shortChargerLabel("Triarc | Bharat DC001", null, 1), "Bharat DC001-1");
});

test("splitActiveSessions drops sessions past 7 hours and older duplicates on a gun", () => {
  const now = new Date("2026-10-18T13:40:00+05:30").getTime();
  const s = (id, gun, startedAt) => ({ id, transactionId: id, chargerId: "dc60", chargerName: "Triarc | DC 60kW CCS-2", connectorId: gun, startedAt, stoppedAt: null });
  const ghost = s("ghost", 2, "2026-10-17T23:48:12+05:30");
  const gun1 = s("g1", 1, "2026-10-18T13:12:14+05:30");
  const gun2 = s("g2", 2, "2026-10-18T13:31:42+05:30");
  const { live, stuck } = splitActiveSessions([ghost, gun1, gun2], now);
  assert.deepEqual(live.map((x) => x.id), ["g1", "g2"]);
  assert.deepEqual(stuck.map((x) => x.id), ["ghost"]);
  const dupe = s("early", 1, "2026-10-18T12:00:00+05:30");
  assert.deepEqual(splitActiveSessions([dupe, gun1], now).stuck.map((x) => x.id), ["early"]);
  assert.equal(isStuckSession(gun1, now), false);
  assert.equal(isStuckSession({ ...ghost, stoppedAt: "2026-10-18T00:30:00+05:30" }, now), false);
});

// Live session metrics, from sessions captured in the ChargeMOD console on 18 Oct 2026.
const set = (t, soc, kw, wh) => [
  { timestamp: t, measurand: "SoC", value: soc, unit: "Percent" },
  { timestamp: t, measurand: "Power.Active.Import", value: kw, unit: "kW" },
  { timestamp: t, measurand: "Energy.Active.Import.Register", value: wh, unit: "Wh" },
];

test("liveMetrics works out battery, kWh to full and time left from meter values", () => {
  // Session …12947473 (DC 60kW): start-up reading at 0 kW, then 21.2 kW from 80% to 86%.
  const readings = [
    ...set("2026-10-18T08:57:00Z", 80, 0, 8911790),
    ...set("2026-10-18T08:57:15Z", 81, 21.22, 8911847),
    ...set("2026-10-18T09:08:00Z", 86, 21.23, 8915650),
    ...set("2026-10-18T09:08:00Z", 86, 21.23, 8915698), // repeated timestamp: the last value wins
  ];
  const m = liveMetrics(readings);
  assert.equal(m.startSoc, 80);
  assert.equal(m.currentSoc, 86);
  assert.equal(m.kwNow, 21.23);
  assert.equal(Math.round(m.kwhDelivered * 1000), 3908);
  assert.equal(m.estimating, false);
  assert.equal(Math.round(m.batteryKwh), 65);
  assert.equal(Math.round(m.kwhToFull * 10), 91);
  // 86→90% at full power, 90→96% at 60%, 96→100% at 30%.
  assert.equal(Math.round(m.minutesLeft), 50);
});

test("liveMetrics matches the handoff sessions and waits for a 5% SoC rise", () => {
  const s2 = liveMetrics([...set("2026-10-18T08:02:00Z", 22, 28.8, 8405325), ...set("2026-10-18T08:52:00Z", 73, 28.8, 8429479)]);
  assert.equal(Math.round(s2.batteryKwh), 47);
  const s1 = liveMetrics([...set("2026-10-18T05:04:00Z", 79, 28.8, 8355018), ...set("2026-10-18T05:27:00Z", 98, 8.6, 8362569)]);
  assert.equal(Math.round(s1.batteryKwh), 40);
  const early = liveMetrics([...set("2026-10-18T09:00:00Z", 40, 28.8, 1000), ...set("2026-10-18T09:03:00Z", 43, 28.8, 2500)]);
  assert.equal(early.estimating, true);
  assert.equal(early.batteryKwh, null);
  assert.equal(early.kwhDelivered, 1.5);
  assert.deepEqual(liveMetrics([]).estimating, true);
});

test("parseMeterValues finds readings in flat and OCPP-shaped payloads", () => {
  const flat = parseMeterValues({ result: { data: [{ valueTimestamp: "2026-10-18T09:08:00Z", value: "86.00", measurand: "SoC", unit: "Percent" }] } });
  assert.deepEqual(flat, [{ measurand: "SoC", value: 86, unit: "Percent", timestamp: "2026-10-18T09:08:00.000Z" }]);
  const ocpp = parseMeterValues({ meterValue: [{ timestamp: "2026-10-18T09:08:00Z", sampledValue: [{ measurand: "SoC", value: "86" }] }] });
  assert.equal(ocpp[0].value, 86);
});

test("summarizeSessions totals AC and DC like ChargeMOD's bill: CPO included (and shown), empty sessions left out", async () => {
  const { summarizeSessions, suggestedLines, periodBounds, itemFor } = await import("../src/app/admin/billing/sessionSuggestion.mjs");
  const rows = [
    { station_type: "DC", charger_name: "Triarc | DC 60kW CCS-2", type: "WALLET", mobile: "9000000001", energy_kwh: "33.965" },
    { station_type: "DC", charger_name: "Triarc | DC 60kW CCS-2", type: "WALLET", mobile: "9000000002", energy_kwh: 19.847 },
    { station_type: "AC", charger_name: "Triarc | AC 3.3kW Socket | A", type: "WALLET", mobile: "9000000003", energy_kwh: 3.174 },
    { station_type: "DC", charger_name: "Triarc | DC 60kW CCS-2", type: "CPO", mobile: "9000000004", energy_kwh: 10 },
    { station_type: "DC", charger_name: "Triarc | DC 60kW CCS-2", type: "", mobile: "+91 98765 43210", energy_kwh: 5 }, // CPO by number
    { station_type: "DC", charger_name: "Triarc | DC 60kW CCS-2", type: "WALLET", mobile: null, energy_kwh: 0 }, // failed
  ];
  const s = summarizeSessions(rows, new Set(["9876543210"]));
  assert.deepEqual(s.DC, { kwh: 68.812, sessions: 4 }); // ChargeMOD bills CPO sessions too
  assert.deepEqual(s.AC, { kwh: 3.174, sessions: 1 });
  assert.deepEqual(s.cpo, { kwh: 15, sessions: 2 });

  const inventory = [
    { id: "ac", product_name: "AC EV Charging", charger_type: "AC", customer_id: null, selling_price: "18", gst_rate: "18", hsn: "996749", unit: "KWH" },
    { id: "dc", product_name: "DC EV Charging", charger_type: "DC", customer_id: null, selling_price: "26", gst_rate: "18", hsn: "996749", unit: "KWH" },
    { id: "dc-cm", product_name: "DC EV Charging", charger_type: "DC", customer_id: "bpm", selling_price: "24", gst_rate: "18", hsn: "996749", unit: "KWH" },
  ];
  assert.equal(itemFor(inventory, "bpm", "DC").id, "dc-cm"); // the customer's own item wins
  assert.equal(itemFor(inventory, "other", "DC").id, "dc"); // else the general one
  const lines = suggestedLines(s, inventory, "bpm");
  assert.deepEqual(lines.map((l) => [l.inventory_id, l.quantity, l.unit_price, l.source_sessions]), [["dc-cm", 68.812, 24, 4], ["ac", 3.174, 18, 1]]);
  assert.equal(lines[0].description, "DC EV Charging"); // just the item name

  const p = periodBounds("2026-10-01", "2026-10-15");
  assert.equal(p.start, "2026-09-30T18:30:00.000Z");
  assert.equal(p.end, "2026-10-15T18:30:00.000Z"); // the 15th is included
});


test("parseMeterValues collects later reading groups and safely ignores invalid timestamps", () => {
  const readings = parseMeterValues({
    result: {
      initial: [{ timestamp: "2026-10-18T14:00:00Z", measurand: "Power.Active.Import", value: "0", unit: "kW" }],
      latest: [{ timestamp: "2026-10-18T14:01:00Z", measurand: "Power.Active.Import", value: "22.4", unit: "kW" }],
      malformed: [{ timestamp: "not-a-date", measurand: "SoC", value: "42", unit: "Percent" }],
    },
  });
  assert.equal(readings.length, 2);
  assert.equal(liveMetrics(readings).kwNow, 22.4);
});

test("parseMeterValues inherits OCPP timestamps and preserves a real zero power reading", () => {
  const readings = parseMeterValues({
    meterValue: [
      { timestamp: "2026-10-18T14:00:00Z", sampledValue: [{ measurand: "Power.Active.Import", value: "18.5", unit: "kW" }] },
      { timestamp: "2026-10-18T14:01:00Z", sampledValue: [{ measurand: "Power.Active.Import", value: "0", unit: "kW" }] },
    ],
  });
  const metrics = liveMetrics(readings);
  assert.equal(readings.length, 2);
  assert.equal(metrics.kwNow, 0);
  assert.equal(metrics.peakKw, 18.5);
  assert.equal(metrics.lastReadingAt, "2026-10-18T14:01:00.000Z");
});

test("backfillWindow accepts a 15-day window and rejects bad ones", () => {
  const now = Date.parse("2026-10-21T08:00:00Z");
  const to = "2026-10-21T08:00:00.000Z";
  const from = "2026-10-06T08:00:00.000Z";
  assert.deepEqual(backfillWindow(from, to, now), { from, to });
  assert.equal(backfillWindow("2026-09-01T00:00:00Z", to, now), null); // too long
  assert.equal(backfillWindow(to, from, now), null); // reversed
  assert.equal(backfillWindow(from, "2026-10-22T08:00:00Z", now), null); // future
  assert.equal(backfillWindow("nope", to, now), null);
  assert.equal(backfillWindow(undefined, to, now), null);
});

test("storedRows keeps one row per session and prefers the finished copy", () => {
  const rows = storedRows(
    [{ transactionId: "a", id: "a", stoppedAt: null }],
    [{ transactionId: "a", id: "a", stoppedAt: "2026-10-20T10:00:00Z" }, { transactionId: "", id: "b", stoppedAt: null }],
    "2026-10-21T00:00:00Z"
  );
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.transaction_id === "a").stopped_at, "2026-10-20T10:00:00Z");
  assert.ok(rows.some((r) => r.transaction_id === "b"));
});

test("previousBillingCycle picks the cycle before the current one, in IST", () => {
  // 21 Oct (16th–end cycle) -> 1–15 Oct
  assert.deepEqual(previousBillingCycle(new Date("2026-10-21T08:00:00Z")), { from: "2026-09-30T18:30:00.000Z", to: "2026-10-15T18:30:00.000Z" });
  // 5 Oct (1st–15th cycle) -> 16–30 Sep
  assert.deepEqual(previousBillingCycle(new Date("2026-10-05T08:00:00Z")), { from: "2026-09-15T18:30:00.000Z", to: "2026-09-30T18:30:00.000Z" });
  // 10 Jan -> 16–31 Dec of the year before (a 16-day cycle the window check accepts)
  const jan = previousBillingCycle(new Date("2027-01-10T08:00:00Z"));
  assert.deepEqual(jan, { from: "2026-12-15T18:30:00.000Z", to: "2026-12-31T18:30:00.000Z" });
  assert.deepEqual(backfillWindow(jan.from, jan.to, Date.parse("2027-01-10T08:00:00Z")), jan);
  // 00:10 IST on the 16th is already the second half
  assert.equal(previousBillingCycle(new Date("2026-10-15T18:40:00Z")).to, "2026-10-15T18:30:00.000Z");
});

test("meterPatch fills Energy/SoC while charging, only empty columns once finished", () => {
  const m = { kwhDelivered: 12.3456, startSoc: 20, currentSoc: 55 };
  assert.deepEqual(meterPatch({ stopped_at: null, energy_kwh: 0, start_soc: null, end_soc: 30 }, m), { energy_kwh: 12.3456, start_soc: 20, end_soc: 55 });
  assert.deepEqual(meterPatch({ stopped_at: "2026-10-20T10:00:00Z", energy_kwh: 11.9, start_soc: 21, end_soc: 80 }, m), {});
  assert.deepEqual(meterPatch({ stopped_at: "2026-10-20T10:00:00Z", energy_kwh: null, start_soc: null, end_soc: null }, m), { energy_kwh: 12.3456, start_soc: 20, end_soc: 55 });
  assert.deepEqual(meterPatch({ stopped_at: null, energy_kwh: 5, start_soc: 10, end_soc: null }, { kwhDelivered: null, startSoc: null, currentSoc: null }), {});
});

test("keepMeterValues keeps stored meter figures on charging sessions only", () => {
  const stored = [{ transaction_id: "a", energy_kwh: 8.2, start_soc: 20, end_soc: 60 }, { transaction_id: "b", energy_kwh: 9, start_soc: 10, end_soc: 90 }];
  const [a, b] = keepMeterValues(
    [{ transaction_id: "a", stopped_at: null, energy_kwh: 0, start_soc: null, end_soc: null }, { transaction_id: "b", stopped_at: "2026-10-20T10:00:00Z", energy_kwh: 9.4, start_soc: 11, end_soc: 92 }],
    stored
  );
  assert.deepEqual([a.energy_kwh, a.start_soc, a.end_soc], [8.2, 20, 60]);
  assert.deepEqual([b.energy_kwh, b.end_soc], [9.4, 92]); // finished: ChargeMOD's final values
});

test("cleanUserName drops ChargeMOD's undefined/null name parts", () => {
  assert.equal(cleanUserName("Guest User undefined"), "Guest User");
  assert.equal(cleanUserName("Kotapati Srinivasa Reddy  undefined"), "Kotapati Srinivasa Reddy");
  assert.equal(cleanUserName(" venky undefined"), "venky");
  assert.equal(cleanUserName("undefined null"), "Unknown");
  assert.equal(cleanUserName(null), "Unknown");
  assert.equal(cleanUserName("Undefinedson Rao"), "Undefinedson Rao");
});

test("platform session ids: prefixed when stored, stripped for the platform's API and for display", async () => {
  const { PROVIDERS, storedSessionId, platformSessionId, displaySessionId, providerLabel } = await import("../src/lib/cms/providerIds.ts");
  const chargemod = PROVIDERS.find((p) => p.id === "chargemod");
  assert.equal(storedSessionId(chargemod, "1792591530932__16183870"), "chrgmod_1792591530932__16183870");
  assert.equal(platformSessionId(chargemod, "chrgmod_1792591530932__16183870"), "1792591530932__16183870");
  assert.equal(platformSessionId(chargemod, "1792591530932__16183870"), "1792591530932__16183870"); // already plain
  assert.equal(storedSessionId(chargemod, ""), ""); // an empty id stays empty
  assert.equal(displaySessionId("chargemod", "chrgmod_abc"), "abc");
  assert.equal(displaySessionId("unknown", "x_abc"), "x_abc");
  assert.equal(providerLabel("chargemod"), "ChargeMOD");
  // ids must stay valid for the live-readings route
  assert.match(storedSessionId(chargemod, "1792591530932__16183870"), /^[\w-]{1,80}$/);
  assert.equal(new Set(PROVIDERS.map((p) => p.idPrefix)).size, PROVIDERS.length); // prefixes are unique
});

test("the platform filter keeps one platform's sessions; storedRows keeps the platform", () => {
  const t = (provider) => ({ provider, id: provider, transactionId: provider, chargerId: "", chargerName: "AC", stationType: "AC", location: "", type: "WALLET", userName: "", mobile: null, vehicleNumber: null, energyKwh: 1 });
  const f = { ...EMPTY_TRANSACTION_FILTERS, provider: "chargemod" };
  assert.equal(matchesTransactionFilters(t("chargemod"), f, false, new Set()), true);
  assert.equal(matchesTransactionFilters(t("ather"), f, false, new Set()), false);
  assert.equal(matchesTransactionFilters(t("ather"), EMPTY_TRANSACTION_FILTERS, false, new Set()), true);
  assert.equal(storedRows([], [{ provider: "ather", transactionId: "ather_1", id: "" }], "2026-10-21T00:00:00Z")[0].provider, "ather");
});

test("filterByStation keeps one station's sessions; all keeps every session", async () => {
  const { filterByStation, stationLocationKey, ALL_STATIONS } = await import("../src/app/admin/cms/transactionFilters.ts");
  const links = new Map([[stationLocationKey("chargemod", "1783154310261"), "bhadrachalam"], [stationLocationKey("ather", "A1"), "bhadrachalam"], [stationLocationKey("chargemod", "456"), "station2"]]);
  const s = (provider, locationId) => ({ provider, locationId });
  const sessions = [s("chargemod", 1783154310261), s("ather", "A1"), s("chargemod", 456), s("chargemod", 999), s("chargemod", null)];
  assert.equal(filterByStation(sessions, links, ALL_STATIONS).length, 5); // unlinked ones too
  assert.deepEqual(filterByStation(sessions, links, "bhadrachalam"), [sessions[0], sessions[1]]); // both platforms, number id matched as text
  assert.deepEqual(filterByStation(sessions, links, "station2"), [sessions[2]]);
  assert.deepEqual(filterByStation(sessions, links, "nowhere"), []);
});

test("displayLocation shows the place, not the company and business", async () => {
  const { displayLocation } = await import("../src/app/admin/cms/transactionFilters.ts");
  assert.equal(displayLocation("Triarc EV hub | Bhadrachalam"), "Bhadrachalam");
  assert.equal(displayLocation("triarc | Khammam"), "Khammam");
  assert.equal(displayLocation("Bhadrachalam"), "Bhadrachalam");
  assert.equal(displayLocation("Triarc EV hub |"), "Triarc EV hub |"); // nothing after it: keep as is
});

test("access roles come from the picklist; partners and IT admins have full access; lock-out guards hold", async () => {
  const { hasFullAccess, accessChangeError, roleLabel, toLevels, isEmail } = await import("../src/lib/adminAccess.ts");
  assert.equal(hasFullAccess("partner"), true);
  assert.equal(hasFullAccess("it_admin"), true);
  assert.equal(hasFullAccess("investor"), false);
  assert.equal(hasFullAccess("accountant"), false); // a new picklist value is limited until marked full
  assert.equal(hasFullAccess(undefined), false);
  assert.equal(roleLabel("it_admin"), "IT admin");
  assert.equal(roleLabel("partner"), "Partner");
  assert.equal(roleLabel("station_manager"), "Station manager");
  assert.deepEqual(toLevels(["partner", "investor"]), [{ id: "partner", label: "Partner", full: true }, { id: "investor", label: "Investor", full: false }]);
  const levels = ["partner", "investor", "it_admin"];
  const admins = [
    { user_id: "p", access: "partner", active: true },
    { user_id: "i", access: "investor", active: true },
  ];
  assert.match(accessChangeError(admins, "p", "p", { access: "investor" }, levels), /your own/);
  assert.match(accessChangeError(admins, "p", "p", { active: false }, levels), /your own/);
  assert.equal(accessChangeError(admins, "p", "i", { access: "it_admin" }, levels), null); // promote an investor
  const two = [...admins, { user_id: "t", access: "it_admin", active: true }];
  assert.equal(accessChangeError(two, "p", "t", { access: "investor" }, levels), null); // p still has full access
  assert.match(accessChangeError([{ user_id: "t", access: "it_admin", active: true }, { user_id: "x", access: "investor", active: true }], "x", "t", { active: false }, levels), /must remain/);
  assert.match(accessChangeError(admins, "p", "nobody", {}, levels), /does not exist/);
  assert.match(accessChangeError(admins, "p", "i", { access: "owner" }, levels), /Unknown/);
  assert.equal(isEmail("a@b.in"), true);
  assert.equal(isEmail("not an email"), false);
});

test("isBot refuses crawlers, AI agents and previews, and lets real browsers through", async () => {
  const { isBot } = await import("../src/lib/bots.ts");
  const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  assert.equal(isBot(chrome), false);
  assert.equal(isBot(iphone), false);
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "facebookexternalhit/1.1", "WhatsApp/2.23.20.0", "Mozilla/5.0 (compatible; SomeNewCrawler/0.1)",
    "curl/8.4.0", "", null,
  ]) assert.equal(isBot(ua), true, String(ua));
});
