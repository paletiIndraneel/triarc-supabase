"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { mergeTransactionData, type CmsCache, type Transaction } from "@/app/admin/cms/CmsDashboard";
import { INVOICE_STATUSES, STATUS_COLORS } from "@/app/admin/billing/EVBilling";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { supabase } from "@/lib/supabase/billing";
import { overviewMetrics } from "./overviewMetrics";
import { getCmsWindowSnapshot, requestCmsWindow, subscribeCmsWindow, type CmsWindowSnapshot } from "@/app/admin/cms/cmsWindowStore";
import { shortChargerLabel, splitActiveSessions } from "@/app/admin/cms/transactionFilters";
import { StationSelect, useStationSelection } from "@/app/admin/cms/stationSelection";
import { billedInCycle, financeMetrics, outstanding, type FinanceInvoice } from "./financeMetrics";

type Enquiry = { id: string; name: string; message: string; status: "New" | "Contacted" | "Closed"; created_at: string };
type Invoice = FinanceInvoice & {
  id: string; invoice_number: string; billing_name: string | null;
  billing_period_from: string | null; billing_period_to: string | null;
};
type Metric = "kwh" | "revenue" | "sessions";
type CmsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; metrics: ReturnType<typeof overviewMetrics>; sessions: Transaction[]; active: number | null; live: Transaction[] | null; updatedAt: string | null; refreshing?: boolean };

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const kwh = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 4 });
const istDay = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const istTime = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
const dataTill = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const istDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const statusLabel = (v: string | null) => (INVOICE_STATUSES.find((x) => x[0] === v) ?? [null, v ?? "-"])[1];
const METRICS: Array<[Metric, string]> = [["kwh", "kWh"], ["revenue", "Revenue"], ["sessions", "Sessions"]];

function when(iso: string) {
  const d = new Date(iso), today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (istDate(d) === istDate(today)) return "Today, " + istTime.format(d);
  if (istDate(d) === istDate(yesterday)) return "Yesterday";
  return istDay.format(d);
}

const card = "rounded-2xl border border-[#e8e9f0] bg-white p-5";

// "16 Oct–31 Oct" -> "16 – 31 Oct"; "16 Sept–30 Sept" -> "16 – 30 Sep".
function prettyRange(label: string) {
  const [from, to] = label.replace(/Sept/g, "Sep").split("–").map((part) => part.trim());
  if (!to) return label.replace(/Sept/g, "Sep");
  const [fromDay, fromMonth] = from.split(" ");
  return fromMonth && to.endsWith(fromMonth) ? `${fromDay} – ${to}` : `${from} – ${to}`;
}

export default function Overview({ enquiries }: { enquiries: Enquiry[] }) {
  const { canOpen, setActiveModule } = useAdminModule();
  const canBill = canOpen("billing"); // invoices are read with the billing module
  const [cms, setCms] = useState<CmsState>({ status: "loading" });
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [billingError, setBillingError] = useState(false);
  const [metric, setMetric] = useState<Metric>("kwh");
  const [hover, setHover] = useState<number | null>(null);

  // CMS (ChargeMOD) can fail on its own; Billing and Enquiries still show when it does.
  // The load is shared with the CMS dashboard (cmsWindowStore), so Refresh on either page
  // is one request and both pages show it.
  // The station selector (shared with the CMS dashboard) narrows the charging figures; invoices
  // stay all stations (older ones have no station). A new choice re-applies the loaded window.
  const { options: stationOptions, stationId, setStation, filterCache } = useStationSelection();
  const windowRequested = useRef(false);
  useEffect(() => {
    let shownCache: CmsCache | null = null;
    const sync = ({ cache: fullCache, refreshing, error }: CmsWindowSnapshot) => {
      if (fullCache && fullCache !== shownCache) {
        shownCache = fullCache;
        const cache = filterCache(fullCache);
        const merged = new Map<string, Transaction>();
        for (const t of [...cache.transactions, ...(cache.active?.transactions ?? [])]) {
          const key = t.transactionId || t.id;
          if (key) merged.set(key, merged.has(key) ? mergeTransactionData(merged.get(key)!, t) : t);
        }
        // Same rule as the CMS Status card: ChargeMOD's stuck sessions are not counted.
        const activeList = cache.active?.transactions;
        const live = activeList
          ? splitActiveSessions(activeList.map((t) => merged.get(t.transactionId || t.id) ?? t)).live
          : null;
        const active = live ? live.length : cache.active?.count ?? null;
        setCms((current) => ({
          status: "ok",
          metrics: overviewMetrics([...merged.values()]),
          sessions: [...merged.values()],
          // The stored copy has no live count; keep the last one rather than flash 0.
          active: active ?? (current.status === "ok" ? current.active : null),
          live: live ?? (current.status === "ok" ? current.live : null),
          updatedAt: cache.coverage.at(-1)?.endDate ?? null,
          refreshing,
        }));
        return;
      }
      setCms((current) =>
        current.status === "ok"
          ? { ...current, refreshing }
          : error
            ? { status: "error", message: error }
            : { status: "loading" }
      );
    };
    sync(getCmsWindowSnapshot());
    const unsubscribe = subscribeCmsWindow(sync);
    if (!windowRequested.current) {
      windowRequested.current = true;
      void requestCmsWindow();
    }
    return unsubscribe;
  }, [filterCache]);
  const loadInvoices = useCallback(() => {
    if (!canBill) return;
    void supabase.from("billing_invoices")
      .select("id, invoice_number, billing_name, invoice_date, due_date, billing_period_from, billing_period_to, invoice_status, grand_total, amount_paid, taxable_amount, cgst_amount, sgst_amount, igst_amount")
      .order("invoice_date", { ascending: false })
      .then(({ data, error }) => {
        setBillingError(Boolean(error));
        if (!error) setInvoices((data ?? []) as Invoice[]);
      });
  }, [canBill]);
  useEffect(loadInvoices, [loadInvoices]);

  // Refresh reloads the charging data (shared with the CMS dashboard) and the invoices.
  const loadCms = useCallback((force = false) => {
    if (force) loadInvoices();
    return requestCmsWindow(force);
  }, [loadInvoices]);

  // Indian financial year: 1 April (IST) onwards.
  const todayIst = istDate(new Date());
  const fyStart = `${Number(todayIst.slice(0, 4)) - (Number(todayIst.slice(5, 7)) < 4 ? 1 : 0)}-04-01`;
  const liveInvoices = (invoices ?? []).filter((i) => i.invoice_status !== "cancelled");
  const fyInvoices = liveInvoices.filter((i) => (i.invoice_date ?? "") >= fyStart);
  const finance = invoices ? financeMetrics(invoices, cms.status === "ok" ? cms.sessions : []) : null;
  const billedFy = fyInvoices.reduce((s, i) => s + Number(i.grand_total || 0), 0);
  const unpaid = liveInvoices.filter((i) => outstanding(i) > 0);
  const newEnquiries = enquiries.filter((e) => e.status === "New").length;

  const days = cms.status === "ok" ? cms.metrics.days : [];
  const values = days.map((d) => d[metric]);
  const max = Math.max(1, ...values);
  const shown = hover ?? days.length - 1;
  const format = (v: number) => (metric === "kwh" ? kwh(v) + " kWh" : metric === "revenue" ? inr(v) : v + " sessions");

  return (
    <main className="min-h-screen bg-[#f8f9ff] text-[#172033]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 pb-12 pt-7 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight">Overview</h1>
            <p className="mt-1 text-sm text-[#5d6577]">
              {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(new Date())}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StationSelect options={stationOptions} stationId={stationId} onChange={setStation} />
            {cms.status === "ok" && cms.updatedAt && (
              <p className="text-xs text-[#5d6577]">Data till {dataTill.format(new Date(cms.updatedAt))}</p>
            )}
            <button
              type="button"
              onClick={() => void loadCms(true)}
              disabled={(cms.status === "loading" || (cms.status === "ok" && cms.refreshing))}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} aria-hidden="true" className={(cms.status === "loading" || (cms.status === "ok" && cms.refreshing)) ? "motion-safe:animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {cms.status === "error" ? (
          <div role="alert" className={`${card} flex flex-wrap items-center gap-3`}>
            <AlertCircle size={20} className="shrink-0 text-[#b42318]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Charging data is unavailable right now</p>
              <p className="mt-0.5 text-sm text-[#5d6577]">The charger system (CMS) did not respond: {cms.message}</p>
            </div>
            <button type="button" onClick={() => void loadCms()} className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#e3e5ec] bg-white px-3.5 text-sm font-semibold hover:bg-slate-50">
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        ) : (
          <>
            <section aria-label="Charging figures" aria-busy={cms.status === "loading"} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {(() => {
                const m = cms.status === "ok" ? cms.metrics : null;
                const sameDays = m ? m.currentCycle.revenue - m.lastMonthSameDaysRevenue : 0;
                const cards = [
                  { label: "Today", dates: istDay.format(new Date()).replace("Sept", "Sep"), kwh: m?.today.kwh, revenue: m?.today.revenue, sessions: m?.today.sessions },
                  { label: "Current cycle", dates: m ? prettyRange(m.currentCycle.label) : "", kwh: m?.currentCycle.kwh, revenue: m?.currentCycle.revenue, sessions: m?.currentCycle.sessions, compare: m ? sameDays : null },
                  { label: "Previous cycle", dates: m ? prettyRange(m.previousCycle.label) : "", kwh: m?.previousCycle.kwh, revenue: m?.previousCycle.revenue, sessions: m?.previousCycle.sessions },
                  { label: "Cycle before", dates: m ? prettyRange(m.olderCycle.label) : "", kwh: m?.olderCycle.kwh, revenue: m?.olderCycle.revenue, sessions: m?.olderCycle.sessions },
                ];
                return cards.map((c) => (
                  <div key={c.label} className={`${card} flex flex-col`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5d6577]">{c.label}</p>
                    <p className="text-xs text-[#5d6577]">{c.dates || "\u00a0"}</p>
                    {c.kwh === undefined ? (
                      <div className="mt-4 h-8 w-32 rounded-md bg-slate-100 motion-safe:animate-pulse" />
                    ) : (
                      <>
                        <p className="mt-3 text-[26px] font-bold leading-tight tracking-tight">{kwh(c.kwh)} kWh</p>
                        <p className="text-lg font-semibold text-[#3d4559]">{inr(c.revenue ?? 0)}</p>
                      </>
                    )}
                    <div className="mt-auto pt-3 text-xs text-[#5d6577]">
                      {c.sessions !== undefined && <p>{c.sessions} sessions</p>}
                      {"compare" in c && c.compare != null && (
                        <p className="mt-1.5 font-semibold" style={{ color: c.compare >= 0 ? "#1e7b3c" : "#c92a2a" }}>
                          {c.compare >= 0 ? "▲" : "▼"} {inr(Math.abs(c.compare))} vs same days last month
                        </p>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </section>

            <section aria-label="Charging now" className={`${card} flex flex-wrap items-center gap-x-6 gap-y-2`}>
              {cms.status === "ok" && cms.active !== null ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${cms.active ? "bg-[#1e8a4c] shadow-[0_0_0_4px_#dcf3e5] motion-safe:animate-pulse" : "border border-slate-400"}`} />
                    {cms.active ? "Charging" : "Idle"}
                    <span className="text-[22px] font-bold">{cms.active}</span>
                  </p>
                  {cms.active ? (
                    <ul className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-1 text-xs text-[#5d6577]">
                      {(cms.live ?? []).map((t) => (
                        <li key={t.transactionId || t.id}>
                          <span className="font-semibold text-[#172033]">{shortChargerLabel(t.chargerName, t.stationType, t.connectorId)}</span>
                          {t.energyKwh != null && ` · ${kwh(t.energyKwh)} kWh`}
                          {t.startedAt && ` · ${istTime.format(new Date(t.startedAt))}`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="flex-1 text-xs text-[#5d6577]">No sessions charging</p>
                  )}
                </>
              ) : <div className="h-8 w-40 flex-1 rounded-md bg-slate-100 motion-safe:animate-pulse" />}
              <button type="button" onClick={() => setActiveModule("cms")} className="ml-auto text-sm font-semibold text-[#5b45c4] hover:text-[#3f2f9a]">Open CMS Dashboard →</button>
            </section>

            <section aria-labelledby="trend-h" className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <h2 id="trend-h" className="text-base font-bold">{METRICS.find((m) => m[0] === metric)?.[1]}, last 30 days</h2>
                <div role="group" aria-label="Chart metric" className="flex gap-1 rounded-[10px] bg-[#f3f4f8] p-[3px]">
                  {METRICS.map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}
                      className={`h-8 rounded-lg px-3 text-xs font-semibold ${metric === key ? "bg-white text-[#172033] shadow-[0_1px_2px_rgba(16,24,40,.08)]" : "text-[#5d6577]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {cms.status === "ok" ? (
                <figure className="mt-4">
                  <p aria-live="polite" className="text-sm"><span className="font-semibold">{days[shown]?.label}</span> <span className="text-[#5d6577]">· {format(values[shown] ?? 0)}</span></p>
                  <div className="mt-2 flex h-[200px] items-end gap-[2px] border-b border-[#e8e9f0]" onMouseLeave={() => setHover(null)} aria-hidden="true">
                    {values.map((v, i) => (
                      <div key={days[i].label} onMouseEnter={() => setHover(i)} className="flex h-full flex-1 items-end">
                        <div className={`w-full rounded-t ${i === shown ? "bg-[#6a4fd6]" : "bg-[#c9bff3]"}`} style={{ height: `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%` }} />
                      </div>
                    ))}
                  </div>
                  <figcaption className="mt-2 flex justify-between text-[11px] text-[#5d6577]"><span>{days[0]?.label}</span><span>Today</span></figcaption>
                  <table className="sr-only">
                    <caption>Daily totals, last 30 days</caption>
                    <thead><tr><th>Day</th><th>kWh</th><th>Revenue</th><th>Sessions</th></tr></thead>
                    <tbody>{days.map((d) => <tr key={d.label}><td>{d.label}</td><td>{kwh(d.kwh)}</td><td>{inr(d.revenue)}</td><td>{d.sessions}</td></tr>)}</tbody>
                  </table>
                </figure>
              ) : <div className="mt-4 h-[230px] rounded-xl bg-slate-50 motion-safe:animate-pulse" />}
            </section>
          </>
        )}

        {canBill && (
          <section aria-labelledby="fin-h" className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="fin-h" className="text-base font-bold">Finance{finance && <span className="ml-2 text-xs font-semibold text-[#5d6577]">{finance.fyLabel}</span>}</h2>
              <button type="button" onClick={() => setActiveModule("billing")} className="text-sm font-semibold text-[#5b45c4] hover:text-[#3f2f9a]">Open Billing</button>
            </div>
            {billingError ? <p role="alert" className="mt-4 text-sm text-[#b42318]">Could not load invoices.</p> : !finance ? (
              <div className="mt-4 h-40 rounded-xl bg-slate-50 motion-safe:animate-pulse" />
            ) : (
              <div className="mt-4 flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ["Receivable", inr(finance.receivable), `${finance.openCount} open invoice${finance.openCount === 1 ? "" : "s"}`],
                    ["Collected this FY", inr(finance.collectedFy), `of ${inr(finance.billedFy)} billed`],
                    ["GST this month", inr(finance.gstMonth.tax), `on ${inr(finance.gstMonth.taxable)} taxable`],
                    ["GST this FY", inr(finance.gstFy.tax), `on ${inr(finance.gstFy.taxable)} taxable`],
                  ].map(([l, v, note]) => (
                    <div key={l} className="rounded-xl bg-[#f8f9ff] p-3.5">
                      <p className="text-xs font-semibold text-[#5d6577]">{l}</p>
                      <p className={`mt-1 text-xl font-bold ${l === "Receivable" && finance.receivable ? "text-[#b35c00]" : ""}`}>{v}</p>
                      <p className="mt-0.5 text-xs text-[#5d6577]">{note}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-bold">Receivables by age</h3>
                    <p className="text-xs text-[#5d6577]">Days past the due date (invoice date when no due date is set).</p>
                    <table className="mt-2 w-full text-sm">
                      <tbody>
                        {([["Not yet due", finance.aging.current], ["1–30 days", finance.aging.d30], ["31–60 days", finance.aging.d60], ["Over 60 days", finance.aging.d90]] as const).map(([l, v]) => (
                          <tr key={l} className="border-t border-[#eef0f4]">
                            <td className="py-2 text-[#5d6577]">{l}</td>
                            <td className="w-1/2 py-2"><div className="h-2 rounded bg-[#f3f4f8]"><div className="h-2 rounded bg-[#b35c00]" style={{ width: `${finance.receivable ? (v / finance.receivable) * 100 : 0}%` }} /></div></td>
                            <td className="py-2 text-right font-semibold tabular-nums">{inr(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold">GST summary</h3>
                    <p className="text-xs text-[#5d6577]">From issued invoices, cancelled ones excluded.</p>
                    <table className="mt-2 w-full text-sm tabular-nums">
                      <thead><tr className="text-xs text-[#5d6577]"><th className="py-1.5 text-left font-semibold"></th><th className="text-right font-semibold">Taxable</th><th className="text-right font-semibold">CGST</th><th className="text-right font-semibold">SGST</th><th className="text-right font-semibold">IGST</th></tr></thead>
                      <tbody>
                        {([["This month", finance.gstMonth], ["This FY", finance.gstFy]] as const).map(([l, g]) => (
                          <tr key={l} className="border-t border-[#eef0f4]">
                            <td className="py-2 text-[#5d6577]">{l}</td>
                            <td className="text-right">{inr(g.taxable)}</td><td className="text-right">{inr(g.cgst)}</td><td className="text-right">{inr(g.sgst)}</td><td className="text-right">{inr(g.igst)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {cms.status === "ok" && (
                  <div>
                    <h3 className="text-sm font-bold">Charging revenue vs invoiced, by billing cycle</h3>
                    <p className="text-xs text-[#5d6577]">Charging revenue is from the CMS; invoiced counts invoices whose billing period ends in the cycle.</p>
                    <table className="mt-2 w-full text-sm tabular-nums">
                      <thead><tr className="text-xs text-[#5d6577]"><th className="py-1.5 text-left font-semibold">Cycle</th><th className="text-right font-semibold">Charging revenue</th><th className="text-right font-semibold">Invoiced</th><th className="text-right font-semibold">Difference</th></tr></thead>
                      <tbody>
                        {[cms.metrics.currentCycle, cms.metrics.previousCycle, cms.metrics.olderCycle].map((c) => {
                          const billed = billedInCycle(invoices ?? [], c.from, c.to);
                          const diff = c.revenue - billed;
                          return (
                            <tr key={c.label} className="border-t border-[#eef0f4]">
                              <td className="py-2 text-[#5d6577]">{c.label}</td>
                              <td className="text-right">{inr(c.revenue)}</td>
                              <td className="text-right">{inr(billed)}</td>
                              <td className={`text-right font-semibold ${Math.round(diff) > 0 ? "text-[#b35c00]" : ""}`}>{inr(diff)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-bold">Monthly trend, {finance.fyLabel}</h3>
                  <p className="text-xs text-[#5d6577]">Invoiced per month. Charging revenue shows only for months the CMS data covers.</p>
                  {(() => {
                    const top = Math.max(1, ...finance.months.map((r) => Math.max(r.billed, r.charging ?? 0)));
                    return (
                      <table className="mt-2 w-full text-sm tabular-nums">
                        <thead><tr className="text-xs text-[#5d6577]"><th className="py-1.5 text-left font-semibold">Month</th><th className="w-2/5"></th><th className="text-right font-semibold">Invoiced</th><th className="text-right font-semibold">GST</th><th className="text-right font-semibold">Charging</th></tr></thead>
                        <tbody>
                          {finance.months.map((r) => (
                            <tr key={r.key} className="border-t border-[#eef0f4]">
                              <td className="py-2 text-[#5d6577]">{r.label}</td>
                              <td className="py-2 pr-3">
                                <div className="h-1.5 rounded bg-[#6a4fd6]" style={{ width: `${(r.billed / top) * 100}%` }} />
                                {r.charging !== null && <div className="mt-1 h-1.5 rounded bg-[#c9bff3]" style={{ width: `${(r.charging / top) * 100}%` }} />}
                              </td>
                              <td className="text-right">{inr(r.billed)}</td>
                              <td className="text-right">{inr(r.gst)}</td>
                              <td className="text-right">{r.charging === null ? "–" : inr(r.charging)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            )}
          </section>
        )}

        <div className={`grid gap-3.5 ${canBill ? "lg:grid-cols-2" : ""}`}>
          {canBill && (
            <section aria-labelledby="bill-h" className={card}>
              <div className="flex items-center justify-between">
                <h2 id="bill-h" className="text-base font-bold">Billing</h2>
                <button type="button" onClick={() => setActiveModule("billing")} className="text-sm font-semibold text-[#5b45c4] hover:text-[#3f2f9a]">Open Billing</button>
              </div>
              {billingError ? <p role="alert" className="mt-4 text-sm text-[#b42318]">Could not load invoices.</p> : invoices === null ? (
                <div className="mt-4 h-24 rounded-xl bg-slate-50 motion-safe:animate-pulse" />
              ) : (
                <>
                  <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                    <div><p className="text-xs text-[#5d6577]">Billed this FY</p><p className="mt-1 text-xl font-bold">{inr(billedFy)}</p></div>
                    <div><p className="text-xs text-[#5d6577]">Invoices this FY</p><p className="mt-1 text-xl font-bold">{fyInvoices.length}</p></div>
                    <div><p className="text-xs text-[#5d6577]">Not paid in full</p><p className={`mt-1 text-xl font-bold ${unpaid.length ? "text-[#b35c00]" : ""}`}>{inr(unpaid.reduce((s, i) => s + outstanding(i), 0))}</p></div>
                  </div>
                  <ul className="mt-4">
                    {liveInvoices.slice(0, 3).map((i) => {
                      const [bg, fg] = STATUS_COLORS[(i.invoice_status ?? "draft") as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.draft;
                      return (
                        <li key={i.id} className="flex justify-between gap-2.5 border-t border-[#eef0f4] py-2.5">
                          <span className="min-w-0"><b className="font-semibold">{i.invoice_number}</b><br /><span className="text-xs text-[#5d6577]">{i.billing_name ?? "-"}{i.billing_period_from && i.billing_period_to ? ` · ${istDay.format(new Date(i.billing_period_from))}–${istDay.format(new Date(i.billing_period_to))}` : ""}</span></span>
                          <span className="text-right">{inr(Number(i.grand_total || 0))}<br /><span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: bg, color: fg }}>{statusLabel(i.invoice_status)}</span></span>
                        </li>
                      );
                    })}
                    {!liveInvoices.length && <li className="border-t border-[#eef0f4] py-3 text-sm text-[#5d6577]">No invoices yet.</li>}
                  </ul>
                </>
              )}
            </section>
          )}

          <section aria-labelledby="enq-h" className={card}>
            <div className="flex items-center justify-between">
              <h2 id="enq-h" className="text-base font-bold">Enquiries {newEnquiries > 0 && <span className="ml-1.5 rounded-full bg-[#eeeaff] px-2 py-0.5 text-xs font-semibold text-[#5b45c4]">{newEnquiries} new</span>}</h2>
              <button type="button" onClick={() => setActiveModule("enquiries")} className="text-sm font-semibold text-[#5b45c4] hover:text-[#3f2f9a]">Open Enquiries</button>
            </div>
            <ul className="mt-3.5">
              {enquiries.slice(0, 3).map((e) => (
                <li key={e.id} className="border-t border-[#eef0f4] py-3">
                  <div className="flex justify-between gap-2"><b className="truncate font-semibold">{e.name}</b><span className="shrink-0 text-xs text-[#5d6577]">{when(e.created_at)}</span></div>
                  <p className="mt-1 truncate text-sm text-[#5d6577]">{e.message}</p>
                </li>
              ))}
              {!enquiries.length && <li className="border-t border-[#eef0f4] py-3 text-sm text-[#5d6577]">No enquiries yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
