// Unit tests for the admin's pure helpers. Run with `npm test` (Node's built-in runner).
import test from "node:test";
import assert from "node:assert/strict";
import { calc, words } from "../src/app/admin/billing/invoiceMath.mjs";
import { getDateRangeIST } from "../src/app/admin/cms/dateRanges.ts";

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
