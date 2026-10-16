"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { loadCmsWindow, mergeTransactionData, type Transaction } from "@/app/admin/cms/CmsDashboard";
import { INVOICE_STATUSES, STATUS_COLORS } from "@/app/admin/billing/EVBilling";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { supabase } from "@/lib/supabase/billing";
import { overviewMetrics } from "./overviewMetrics";

type Enquiry = { id: string; name: string; message: string; status: "New" | "Contacted" | "Closed"; created_at: string };
type Invoice = {
  id: string; invoice_number: string; billing_name: string | null; grand_total: number | null;
  invoice_status: string | null; invoice_date: string | null; billing_period_from: string | null; billing_period_to: string | null;
};
type Metric = "kwh" | "revenue" | "sessions";
type CmsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; metrics: ReturnType<typeof overviewMetrics>; active: number; updatedAt: string | null };

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const kwh = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: n >= 100 ? 0 : 1 });
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

export default function Overview({ enquiries }: { enquiries: Enquiry[] }) {
  const { isPartner, setActiveModule } = useAdminModule();
  const [cms, setCms] = useState<CmsState>({ status: "loading" });
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [billingError, setBillingError] = useState(false);
  const [metric, setMetric] = useState<Metric>("kwh");
  const [hover, setHover] = useState<number | null>(null);

  // CMS (ChargeMOD) can fail on its own; Billing and Enquiries still show when it does.
  const loadCms = useCallback(async (force = false) => {
    setCms({ status: "loading" });
    try {
      const cache = await loadCmsWindow(force);
      const merged = new Map<string, Transaction>();
      for (const t of [...cache.transactions, ...(cache.active?.transactions ?? [])]) {
        const key = t.transactionId || t.id;
        if (key) merged.set(key, merged.has(key) ? mergeTransactionData(merged.get(key)!, t) : t);
      }
      setCms({
        status: "ok",
        metrics: overviewMetrics([...merged.values()]),
        active: cache.active?.count ?? cache.active?.transactions?.length ?? 0,
        updatedAt: cache.coverage.at(-1)?.endDate ?? null,
      });
    } catch (error) {
      setCms({ status: "error", message: error instanceof Error ? error.message : "Could not load charging data." });
    }
  }, []);

  useEffect(() => { void loadCms(); }, [loadCms]);

  useEffect(() => {
    if (!isPartner) return;
    supabase.from("billing_invoices")
      .select("id, invoice_number, billing_name, grand_total, invoice_status, invoice_date, billing_period_from, billing_period_to")
      .neq("invoice_status", "cancelled")
      .order("invoice_date", { ascending: false })
      .then(({ data, error }) => { if (error) setBillingError(true); else setInvoices((data ?? []) as Invoice[]); });
  }, [isPartner]);

  // Indian financial year: 1 April (IST) onwards.
  const todayIst = istDate(new Date());
  const fyStart = `${Number(todayIst.slice(0, 4)) - (Number(todayIst.slice(5, 7)) < 4 ? 1 : 0)}-04-01`;
  const fyInvoices = (invoices ?? []).filter((i) => (i.invoice_date ?? "") >= fyStart);
  const billedFy = fyInvoices.reduce((s, i) => s + Number(i.grand_total || 0), 0);
  const unpaid = (invoices ?? []).filter((i) => ["issued", "sent", "partially_paid"].includes(i.invoice_status ?? ""));
  const newEnquiries = enquiries.filter((e) => e.status === "New").length;
  const monthLabel = `1–${istDay.format(new Date())}`;

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
            {cms.status === "ok" && cms.updatedAt && (
              <p className="text-xs text-[#5d6577]">Data till {dataTill.format(new Date(cms.updatedAt))}</p>
            )}
            <button
              type="button"
              onClick={() => void loadCms(true)}
              disabled={cms.status === "loading"}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} aria-hidden="true" className={cms.status === "loading" ? "motion-safe:animate-spin" : ""} />
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
            <section aria-label="Charging figures" aria-busy={cms.status === "loading"} className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              {[
                { label: "Energy today", value: cms.status === "ok" ? `${kwh(cms.metrics.today.kwh)} kWh` : null, note: cms.status === "ok" ? `${cms.metrics.today.sessions} sessions` : null },
                { label: `Energy, ${monthLabel}`, value: cms.status === "ok" ? `${kwh(cms.metrics.monthToDate.kwh)} kWh` : null, note: cms.status === "ok" ? `${cms.metrics.monthToDate.sessions} sessions` : null },
                { label: `Revenue, ${monthLabel}`, value: cms.status === "ok" ? inr(cms.metrics.monthToDate.revenue) : null, note: cms.status === "ok" ? `${inr(cms.metrics.lastMonthSameDaysRevenue)} same days last month` : null },
              ].map((k) => (
                <div key={k.label} className={card}>
                  <p className="text-xs font-semibold text-[#5d6577]">{k.label}</p>
                  {k.value === null ? <div className="mt-3 h-8 w-32 rounded-md bg-slate-100 motion-safe:animate-pulse" /> : <p className="mt-2 text-[28px] font-bold tracking-tight">{k.value}</p>}
                  {k.note && <p className="mt-1.5 text-xs text-[#5d6577]">{k.note}</p>}
                </div>
              ))}
              <div className={card}>
                <p className="text-xs font-semibold text-[#5d6577]">Charging now</p>
                {cms.status === "ok" ? (
                  <p className="mt-2 flex items-center gap-2.5 text-[28px] font-bold">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${cms.active ? "bg-[#1e8a4c] shadow-[0_0_0_4px_#dcf3e5]" : "bg-slate-300"}`} />
                    {cms.active}
                  </p>
                ) : <div className="mt-3 h-8 w-16 rounded-md bg-slate-100 motion-safe:animate-pulse" />}
                <button type="button" onClick={() => setActiveModule("cms")} className="mt-1.5 text-xs font-semibold text-[#5b45c4] hover:text-[#3f2f9a]">Open CMS Dashboard</button>
              </div>
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

        <div className={`grid gap-3.5 ${isPartner ? "lg:grid-cols-2" : ""}`}>
          {isPartner && (
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
                    <div><p className="text-xs text-[#5d6577]">Not paid in full</p><p className={`mt-1 text-xl font-bold ${unpaid.length ? "text-[#b35c00]" : ""}`}>{inr(unpaid.reduce((s, i) => s + Number(i.grand_total || 0), 0))}</p></div>
                  </div>
                  <ul className="mt-4">
                    {invoices.slice(0, 3).map((i) => {
                      const [bg, fg] = STATUS_COLORS[(i.invoice_status ?? "draft") as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.draft;
                      return (
                        <li key={i.id} className="flex justify-between gap-2.5 border-t border-[#eef0f4] py-2.5">
                          <span className="min-w-0"><b className="font-semibold">{i.invoice_number}</b><br /><span className="text-xs text-[#5d6577]">{i.billing_name ?? "-"}{i.billing_period_from && i.billing_period_to ? ` · ${istDay.format(new Date(i.billing_period_from))}–${istDay.format(new Date(i.billing_period_to))}` : ""}</span></span>
                          <span className="text-right">{inr(Number(i.grand_total || 0))}<br /><span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: bg, color: fg }}>{statusLabel(i.invoice_status)}</span></span>
                        </li>
                      );
                    })}
                    {!invoices.length && <li className="border-t border-[#eef0f4] py-3 text-sm text-[#5d6577]">No invoices yet.</li>}
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
