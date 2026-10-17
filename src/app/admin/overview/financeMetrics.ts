// Finance figures for the Overview, from billing invoices and CMS sessions. Pure, so it is unit-tested.
export type FinanceInvoice = {
  invoice_date: string | null; due_date?: string | null; billing_period_to?: string | null;
  invoice_status: string | null; grand_total: number | null; amount_paid?: number | null;
  taxable_amount?: number | null; cgst_amount?: number | null; sgst_amount?: number | null; igst_amount?: number | null;
};
type Session = { startedAt: string | null; tariffAmount: number | null };
export type GstTotals = { taxable: number; cgst: number; sgst: number; igst: number; tax: number; invoices: number };
export type MonthRow = { key: string; label: string; billed: number; gst: number; charging: number | null };

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const istDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const OPEN = ["issued", "sent", "partially_paid"];
const DAY = 86400000;

export function outstanding(i: FinanceInvoice) {
  if (!OPEN.includes(i.invoice_status ?? "")) return 0;
  return Math.max(0, n(i.grand_total) - n(i.amount_paid));
}

export function financeMetrics(invoices: FinanceInvoice[], sessions: Session[], now = new Date()) {
  const today = istDate(now);
  const [y, m] = today.split("-").map(Number);
  const fyYear = m < 4 ? y - 1 : y;
  const fyStart = `${fyYear}-04-01`;
  const monthKey = today.slice(0, 7);
  const live = invoices.filter((i) => i.invoice_status !== "cancelled");

  const gst = (rows: FinanceInvoice[]): GstTotals => {
    const t = { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, invoices: rows.length };
    for (const i of rows) { t.taxable += n(i.taxable_amount); t.cgst += n(i.cgst_amount); t.sgst += n(i.sgst_amount); t.igst += n(i.igst_amount); }
    t.tax = t.cgst + t.sgst + t.igst;
    return t;
  };
  const fy = live.filter((i) => (i.invoice_date ?? "") >= fyStart);

  // Receivables, aged from the due date (else the invoice date).
  const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
  let receivable = 0, openCount = 0;
  for (const i of live) {
    const due = outstanding(i);
    if (!due) continue;
    receivable += due; openCount += 1;
    const from = i.due_date || i.invoice_date;
    const days = from ? Math.floor((Date.parse(today) - Date.parse(from)) / DAY) : 0;
    if (days <= 0) aging.current += due; else if (days <= 30) aging.d30 += due; else if (days <= 60) aging.d60 += due; else aging.d90 += due;
  }
  const collected = fy.reduce((s, i) => s + Math.min(n(i.amount_paid), n(i.grand_total)), 0);

  // Month by month for the financial year. Charging revenue only for months the CMS window covers.
  const charging = new Map<string, number>();
  for (const s of sessions) {
    if (!s.startedAt || s.tariffAmount == null || !Number.isFinite(Number(s.tariffAmount))) continue;
    const k = istDate(new Date(s.startedAt)).slice(0, 7);
    charging.set(k, (charging.get(k) ?? 0) + Number(s.tariffAmount));
  }
  const label = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
  const months: MonthRow[] = [];
  for (let k = 0; k < 12; k += 1) {
    const d = new Date(Date.UTC(fyYear, 3 + k, 1));
    const key = d.toISOString().slice(0, 7);
    if (key > monthKey) break;
    const rows = fy.filter((i) => (i.invoice_date ?? "").startsWith(key));
    months.push({ key, label: label.format(d), billed: rows.reduce((s, i) => s + n(i.grand_total), 0), gst: gst(rows).tax, charging: charging.get(key) ?? null });
  }

  return {
    fyLabel: `FY ${fyYear}-${String(fyYear + 1).slice(2)}`,
    billedFy: fy.reduce((s, i) => s + n(i.grand_total), 0),
    collectedFy: collected,
    receivable, openCount, aging,
    gstMonth: gst(live.filter((i) => (i.invoice_date ?? "").startsWith(monthKey))),
    gstFy: gst(fy),
    months,
  };
}

// Invoiced amount for a billing cycle: invoices whose billing period ends inside it.
export function billedInCycle(invoices: FinanceInvoice[], from: string, toExclusive: string) {
  return invoices
    .filter((i) => i.invoice_status !== "cancelled" && (i.billing_period_to ?? "") >= from && (i.billing_period_to ?? "") < toExclusive)
    .reduce((s, i) => s + n(i.grand_total), 0);
}
