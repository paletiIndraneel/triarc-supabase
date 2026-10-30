"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertCircle, BarChart3, CalendarDays, Inbox, ReceiptText, RefreshCw, Wallet, type LucideIcon } from "lucide-react";
import SlidingTabs from "@/components/ui/SlidingTabs";
import { mergeTransactionData, type CmsCache, type Transaction } from "@/app/admin/cms/CmsDashboard";
import { INVOICE_STATUSES, STATUS_COLORS } from "@/app/admin/billing/EVBilling";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { supabase } from "@/lib/supabase/billing";
import { overviewMetrics } from "./overviewMetrics";
import { comparisonCycle, cyclesBack, type CycleRule } from "@/lib/billingCycle";
import { getCmsWindowSnapshot, requestCmsWindow, subscribeCmsWindow, type CmsWindowSnapshot } from "@/app/admin/cms/cmsWindowStore";
import { shortChargerLabel, splitActiveSessions } from "@/app/admin/cms/transactionFilters";
import { StationSelect, useStationSelection } from "@/app/admin/cms/stationSelection";
import { PlatformSelect, usePlatformSelection } from "@/app/admin/cms/platformSelection";
import { billedInCycle, financeMetrics, outstanding, type FinanceInvoice } from "./financeMetrics";

// The three cycles the cards cover plus what the current one is compared against, all from the
// one cycle definition in @/lib/billingCycle, so a change of billing rule moves these together.
function overviewCycles(rule: CycleRule, now = new Date()) {
  const [older, previous, current] = cyclesBack(now, 3, rule);
  return { current, previous, older, comparison: comparisonCycle(now, rule) };
}

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

const card = "rounded-2xl border border-line bg-surface p-5";
// Widget header, after Kokonut UI's Widget Grid: a muted icon and a small title.
const widgetTitle = "flex items-center gap-2 text-[13px] font-medium text-muted";
function WidgetTitle({ icon: Icon, children, id }: { icon: LucideIcon; children: React.ReactNode; id?: string }) {
  return <h2 id={id} className={widgetTitle}><Icon aria-hidden="true" className="size-3.5" />{children}</h2>;
}

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
  // The cards follow one platform and its billing cycle; see cms/platformSelection.
  const [livePlatforms, setLivePlatforms] = useState<string[]>([]);
  const { options: platformOptions, providerId, rule, setPlatform } = usePlatformSelection(livePlatforms);
  const windowRequested = useRef(false);
  useEffect(() => {
    let shownCache: CmsCache | null = null;
    const sync = ({ cache: fullCache, refreshing, error }: CmsWindowSnapshot) => {
      if (fullCache && fullCache !== shownCache) {
        shownCache = fullCache;
        // From the unfiltered cache, so choosing a platform never narrows what is on offer.
        setLivePlatforms([...new Set(fullCache.transactions.map((t) => t.provider).filter((id): id is string => !!id))].sort());
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
          metrics: overviewMetrics(
            providerId ? [...merged.values()].filter((t) => t.provider === providerId) : [...merged.values()],
            new Date(),
            overviewCycles(rule)
          ),
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
  }, [filterCache, rule, providerId]);
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
    <main className="min-h-screen bg-page text-ink">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 pb-12 pt-7 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight">Overview</h1>
            <p className="mt-1 text-sm text-muted">
              {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(new Date())}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PlatformSelect options={platformOptions} providerId={providerId} onChange={setPlatform} />
            <StationSelect options={stationOptions} stationId={stationId} onChange={setStation} />
            {cms.status === "ok" && cms.updatedAt && (
              <p className="text-xs text-muted">Data till {dataTill.format(new Date(cms.updatedAt))}</p>
            )}
            <button
              type="button"
              onClick={() => void loadCms(true)}
              disabled={(cms.status === "loading" || (cms.status === "ok" && cms.refreshing))}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-3.5 py-2 text-sm font-semibold text-ink hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
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
              <p className="mt-0.5 text-sm text-muted">The charger system (CMS) did not respond: {cms.message}</p>
            </div>
            <button type="button" onClick={() => void loadCms()} className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 text-sm font-semibold hover:bg-raised">
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        ) : (
          <>
            <section aria-label="Charging figures" aria-busy={cms.status === "loading"} className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,2.4fr)]">
              {(() => {
                type Totals = { kwh: number; revenue: number; sessions: number };
                const m = cms.status === "ok" ? cms.metrics : null;
                const skeleton = <div className="mt-3 h-9 w-28 rounded-md bg-soft motion-safe:animate-pulse" />;
                // One figure block — kWh large, revenue and sessions under it, then the optional
                // comparison. Today and every billing cycle use it, so the two cards read alike.
                const figures = (t: Totals, delta: number | null) => (
                  <span className="text-right text-lg font-semibold leading-tight tracking-tight tabular-nums">
                    {kwh(t.kwh)} kWh
                    <span className="block whitespace-nowrap text-xs font-medium text-muted">{inr(t.revenue)} · {t.sessions} sessions</span>
                    {delta != null && (
                      <span className={`block whitespace-nowrap text-xs font-medium ${delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {delta >= 0 ? "▲" : "▼"} {kwh(Math.abs(delta))} kWh
                      </span>
                    )}
                  </span>
                );
                const blocks: Array<{ label: string; dates: string; totals: Totals | null; delta: number | null }> = m
                  ? [
                      { label: "Current cycle", dates: prettyRange(m.currentCycle.label), totals: m.currentCycle, delta: m.currentCycle.kwh - m.lastMonthSameDaysKwh },
                      { label: "Previous cycle", dates: prettyRange(m.previousCycle.label), totals: m.previousCycle, delta: null },
                      { label: "Cycle before", dates: prettyRange(m.olderCycle.label), totals: m.olderCycle, delta: null },
                    ]
                  : ["Current cycle", "Previous cycle", "Cycle before"].map((label) => ({ label, dates: "", totals: null, delta: null }));

                return (
                  <>
                    <div className={`${card} flex flex-col`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={widgetTitle}><CalendarDays aria-hidden="true" className="size-3.5" />Today</p>
                        <p className="text-xs tabular-nums text-muted">{istDay.format(new Date()).replace("Sept", "Sep")}</p>
                      </div>
                      {m ? <div className="mt-2.5 flex justify-end">{figures(m.today, null)}</div> : skeleton}
                    </div>

                    <div className={`${card} flex flex-col`}>
                      <p className={widgetTitle}><CalendarDays aria-hidden="true" className="size-3.5" />Billing cycles</p>
                      <div className="mt-2.5 grid grid-cols-1 gap-y-3 sm:grid-cols-3 sm:gap-x-5">
                        {blocks.map((b, i) => (
                          <div key={b.label} className={`min-w-0 ${i ? "border-t border-line pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0" : ""}`}>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{b.label}</p>
                            {b.totals ? (
                              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                                <span className="whitespace-nowrap text-[11px] font-medium text-muted">{b.dates}</span>
                                {figures(b.totals, b.delta)}
                              </div>
                            ) : skeleton}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </section>

            <section aria-label="Charging now" className={`${card} flex flex-wrap items-center gap-x-6 gap-y-2`}>
              <p className={widgetTitle}><Activity aria-hidden="true" className="size-3.5" />Charging now</p>
              {cms.status === "ok" && cms.active !== null ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${cms.active ? "bg-emerald-500 ring-4 ring-emerald-500/20 motion-safe:animate-pulse" : "border border-line"}`} />
                    {cms.active ? "Charging" : "Idle"}
                    <span className="text-[22px] font-semibold tabular-nums">{cms.active}</span>
                  </p>
                  {cms.active ? (
                    <ul className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                      {(cms.live ?? []).map((t) => (
                        <li key={t.transactionId || t.id}>
                          <span className="font-semibold text-ink">{shortChargerLabel(t.chargerName, t.stationType, t.connectorId)}</span>
                          {t.energyKwh != null && ` · ${kwh(t.energyKwh)} kWh`}
                          {t.startedAt && ` · ${istTime.format(new Date(t.startedAt))}`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="flex-1 text-xs text-muted">No sessions charging</p>
                  )}
                </>
              ) : <div className="h-8 w-40 flex-1 rounded-md bg-soft motion-safe:animate-pulse" />}
              <button type="button" onClick={() => setActiveModule("cms")} className="ml-auto text-sm font-semibold text-accent hover:text-accent-hover">Open CMS Dashboard →</button>
            </section>

            <section aria-labelledby="trend-h" className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <WidgetTitle icon={BarChart3} id="trend-h">{METRICS.find((m) => m[0] === metric)?.[1]}, last 30 days</WidgetTitle>
                <SlidingTabs
                  items={METRICS.map(([id, label]) => ({ id, label }))}
                  label="Chart metric"
                  onChange={setMetric}
                  textClassName="text-xs font-semibold leading-5"
                  itemClassName="px-3 py-1"
                  value={metric}
                />
              </div>
              {cms.status === "ok" ? (
                <figure className="mt-4">
                  {(() => {
                    // The top of the scale, rounded up to a round number so the axis reads cleanly.
                    const mag = Math.pow(10, Math.floor(Math.log10(max)));
                    const top = Math.ceil(max / (mag / 2)) * (mag / 2) || 1;
                    const total = values.reduce((s, v) => s + v, 0);
                    const best = Math.max(0, ...values);
                    const bestDay = days[values.indexOf(best)]?.label ?? "";
                    const axis = (v: number) =>
                      metric === "revenue"
                        ? v >= 1000 ? "₹" + Math.round(v / 1000) + "k" : "₹" + Math.round(v)
                        : Math.round(v).toLocaleString("en-IN");
                    // Rounded, for the summary figures: four decimals are noise there.
                    const brief = (v: number) =>
                      metric === "kwh" ? (Math.round(v * 10) / 10).toLocaleString("en-IN") + " kWh"
                        : metric === "revenue" ? inr(v) : Math.round(v) + " sessions";
                    const ticks = [0, 7, 14, 21, days.length - 1].filter((i) => i >= 0 && i < days.length);
                    return (
                      <>
                        <div className="flex flex-wrap gap-x-7 gap-y-2.5">
                          {([["30-day total", brief(total)], ["Daily average", brief(total / (values.length || 1))], ["Best day", brief(best)]] as const).map(([l, v]) => (
                            <div key={l} className="min-w-0">
                              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">{l}</span>
                              <span className="text-[17px] font-semibold tracking-tight tabular-nums">
                                {v}
                                {l === "Best day" && bestDay && <em className="ml-1.5 text-xs font-medium not-italic text-muted">{bestDay}</em>}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="relative mt-4 pl-14">
                          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-14 right-0">
                            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                              <span key={f} className={`absolute inset-x-0 border-t border-line ${f ? "border-dashed" : ""}`} style={{ bottom: `${f * 100}%` }}>
                                <em className="absolute -top-[0.72em] right-[calc(100%+9px)] whitespace-nowrap text-[11px] not-italic tabular-nums text-muted">{axis(top * f)}</em>
                              </span>
                            ))}
                          </div>
                          <div className="relative" onMouseLeave={() => setHover(null)}>
                            <div className="flex h-[220px] items-end gap-[2px]" aria-hidden="true">
                              {values.map((v, i) => (
                                <div
                                  key={days[i].label}
                                  onMouseEnter={() => setHover(i)}
                                  className={`flex h-full flex-1 items-end rounded-t ${i === hover ? "bg-accent-pale" : ""}`}
                                >
                                  <div className="w-full rounded-t-[3px] bg-accent" style={{ height: `${Math.max(v > 0 ? 1.5 : 0, (v / top) * 100)}%` }} />
                                </div>
                              ))}
                            </div>
                            {hover !== null && days[hover] && (
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-[10px] border border-line bg-surface px-2.5 py-2 text-xs shadow-lg"
                                style={{
                                  left: `${Math.min(90, Math.max(10, ((hover + 0.5) / (values.length || 1)) * 100))}%`,
                                  bottom: `${Math.min(55, ((values[hover] ?? 0) / top) * 100 + 3)}%`,
                                }}
                              >
                                <b className="block pb-0.5 font-semibold">{days[hover].label}</b>
                                <span className="tabular-nums">{format(values[hover] ?? 0)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <figcaption className="mt-2 flex justify-between pl-14 text-[11px] text-muted">
                          {ticks.map((i) => <span key={i}>{i === days.length - 1 ? "Today" : days[i].label}</span>)}
                        </figcaption>
                        <p aria-live="polite" className="sr-only">{days[shown]?.label} · {format(values[shown] ?? 0)}</p>
                        <table className="sr-only">
                          <caption>Daily totals, last 30 days</caption>
                          <thead><tr><th>Day</th><th>kWh</th><th>Revenue</th><th>Sessions</th></tr></thead>
                          <tbody>{days.map((d) => <tr key={d.label}><td>{d.label}</td><td>{kwh(d.kwh)}</td><td>{inr(d.revenue)}</td><td>{d.sessions}</td></tr>)}</tbody>
                        </table>
                      </>
                    );
                  })()}
                </figure>
              ) : <div className="mt-4 h-[230px] rounded-xl bg-raised motion-safe:animate-pulse" />}
            </section>
          </>
        )}

        {canBill && (
          <section aria-labelledby="fin-h" className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <WidgetTitle icon={Wallet} id="fin-h">Finance{finance && <span className="text-xs text-muted">· {finance.fyLabel}</span>}</WidgetTitle>
              <button type="button" onClick={() => setActiveModule("billing")} className="text-sm font-semibold text-accent hover:text-accent-hover">Open Billing</button>
            </div>
            {billingError ? <p role="alert" className="mt-4 text-sm text-[#b42318]">Could not load invoices.</p> : !finance ? (
              <div className="mt-4 h-40 rounded-xl bg-raised motion-safe:animate-pulse" />
            ) : (
              <div className="mt-4 flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ["Receivable", inr(finance.receivable), `${finance.openCount} open invoice${finance.openCount === 1 ? "" : "s"}`],
                    ["Collected this FY", inr(finance.collectedFy), `of ${inr(finance.billedFy)} billed`],
                    ["GST this month", inr(finance.gstMonth.tax), `on ${inr(finance.gstMonth.taxable)} taxable`],
                    ["GST this FY", inr(finance.gstFy.tax), `on ${inr(finance.gstFy.taxable)} taxable`],
                  ].map(([l, v, note]) => (
                    <div key={l} className="rounded-xl bg-raised px-3.5 py-3">
                      <p className="text-xs font-semibold text-muted">{l}</p>
                      <p className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${l === "Receivable" && finance.receivable ? "text-[#b35c00]" : ""}`}>{v}</p>
                      <p className="mt-0.5 text-xs text-muted">{note}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-bold">Receivables by age</h3>
                    <p className="text-xs text-muted">Days past the due date (invoice date when no due date is set).</p>
                    <table className="mt-2 w-full text-sm">
                      <tbody>
                        {([["Not yet due", finance.aging.current], ["1–30 days", finance.aging.d30], ["31–60 days", finance.aging.d60], ["Over 60 days", finance.aging.d90]] as const).map(([l, v]) => (
                          <tr key={l} className="border-t border-line">
                            <td className="py-2 text-muted">{l}</td>
                            <td className="w-1/2 py-2"><div className="h-2 rounded bg-raised"><div className="h-2 rounded bg-[#b35c00]" style={{ width: `${finance.receivable ? (v / finance.receivable) * 100 : 0}%` }} /></div></td>
                            <td className="py-2 text-right font-semibold tabular-nums">{inr(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold">GST summary</h3>
                    <p className="text-xs text-muted">From issued invoices, cancelled ones excluded.</p>
                    <table className="mt-2 w-full text-sm tabular-nums">
                      <thead><tr className="text-xs text-muted"><th className="py-1.5 text-left font-semibold"></th><th className="text-right font-semibold">Taxable</th><th className="text-right font-semibold">CGST</th><th className="text-right font-semibold">SGST</th><th className="text-right font-semibold">IGST</th></tr></thead>
                      <tbody>
                        {([["This month", finance.gstMonth], ["This FY", finance.gstFy]] as const).map(([l, g]) => (
                          <tr key={l} className="border-t border-line">
                            <td className="py-2 text-muted">{l}</td>
                            <td className="text-right">{inr(g.taxable)}</td><td className="text-right">{inr(g.cgst)}</td><td className="text-right">{inr(g.sgst)}</td><td className="text-right">{inr(g.igst)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {cms.status === "ok" && (
                  <div>
                    {(() => {
                      const rows = ([
                        ["Current cycle", cms.metrics.currentCycle],
                        ["Previous cycle", cms.metrics.previousCycle],
                        ["Cycle before", cms.metrics.olderCycle],
                      ] as const).map(([name, c]) => {
                        const billed = billedInCycle(invoices ?? [], c.from, c.to);
                        return { name, cycle: c, billed, gap: c.revenue - billed };
                      });
                      // What charging has earned that no invoice covers yet: the figure this
                      // section exists for, so it leads rather than sitting in a column.
                      const gap = rows.reduce((s, r) => s + Math.max(0, r.gap), 0);
                      return (
                        <>
                          <div className="rounded-2xl border border-line bg-raised px-4 py-4">
                            <span className="block text-xs font-semibold text-muted">Earned, not invoiced</span>
                            <span className={`text-3xl font-bold leading-tight tracking-tight tabular-nums ${gap ? "text-[#b35c00]" : ""}`}>{inr(gap)}</span>
                            <span className="block text-xs text-muted">across the last {rows.length} billing cycles</span>
                          </div>
                          <h3 className="mt-4 text-sm font-bold">Earned against invoiced, by billing cycle</h3>
                          <p className="text-xs text-muted">Charging revenue is from the CMS. The bar fills as invoices are raised for that cycle.</p>
                          <ul className="mt-1.5">
                            {rows.map(({ name, cycle, billed }) => (
                              <li key={cycle.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-2 sm:grid-cols-[minmax(110px,1fr)_minmax(70px,1.2fr)_auto_auto]">
                                <span className="min-w-0 text-xs font-semibold">
                                  {name}
                                  <em className="block text-[10px] font-medium not-italic text-muted">{prettyRange(cycle.label)}</em>
                                </span>
                                <span className="hidden h-1.5 overflow-hidden rounded-full bg-soft sm:block">
                                  <span className="block h-1.5 bg-accent" style={{ width: `${cycle.revenue ? Math.min(100, (billed / cycle.revenue) * 100) : 0}%` }} />
                                </span>
                                <span className="whitespace-nowrap text-right text-[13px] font-semibold tabular-nums">
                                  {inr(cycle.revenue)}
                                  <em className="block text-[10px] font-medium not-italic text-muted">{inr(billed)} invoiced</em>
                                </span>
                                <button type="button" onClick={() => setActiveModule("billing")} className="col-span-full justify-self-end whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-accent hover:bg-accent-pale sm:col-span-1">
                                  Raise invoice
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-bold">Monthly trend, {finance.fyLabel}</h3>
                  <p className="text-xs text-muted">Invoiced per month. Charging revenue shows only for months the CMS data covers.</p>
                  {(() => {
                    const top = Math.max(1, ...finance.months.map((r) => Math.max(r.billed, r.charging ?? 0)));
                    return (
                      <table className="mt-2 w-full text-sm tabular-nums">
                        <thead><tr className="text-xs text-muted"><th className="py-1.5 text-left font-semibold">Month</th><th className="w-2/5"></th><th className="text-right font-semibold">Invoiced</th><th className="text-right font-semibold">GST</th><th className="text-right font-semibold">Charging</th></tr></thead>
                        <tbody>
                          {finance.months.map((r) => (
                            <tr key={r.key} className="border-t border-line">
                              <td className="py-2 text-muted">{r.label}</td>
                              <td className="py-2 pr-3">
                                <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(r.billed / top) * 100}%` }} />
                                {r.charging !== null && <div className="mt-1 h-1.5 rounded-full bg-taupe/50" style={{ width: `${(r.charging / top) * 100}%` }} />}
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
                <WidgetTitle icon={ReceiptText} id="bill-h">Billing</WidgetTitle>
                <button type="button" onClick={() => setActiveModule("billing")} className="text-sm font-semibold text-accent hover:text-accent-hover">Open Billing</button>
              </div>
              {billingError ? <p role="alert" className="mt-4 text-sm text-[#b42318]">Could not load invoices.</p> : invoices === null ? (
                <div className="mt-4 h-24 rounded-xl bg-raised motion-safe:animate-pulse" />
              ) : (
                <>
                  <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                    <div><p className="text-xs text-muted">Billed this FY</p><p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{inr(billedFy)}</p></div>
                    <div><p className="text-xs text-muted">Invoices this FY</p><p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{fyInvoices.length}</p></div>
                    <div><p className="text-xs text-muted">Not paid in full</p><p className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${unpaid.length ? "text-[#b35c00]" : ""}`}>{inr(unpaid.reduce((s, i) => s + outstanding(i), 0))}</p></div>
                  </div>
                  <ul className="mt-4">
                    {liveInvoices.slice(0, 3).map((i) => {
                      const [bg, fg] = STATUS_COLORS[(i.invoice_status ?? "draft") as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.draft;
                      return (
                        <li key={i.id} className="flex justify-between gap-2.5 border-t border-line py-2.5">
                          <span className="min-w-0"><b className="font-semibold">{i.invoice_number}</b><br /><span className="text-xs text-muted">{i.billing_name ?? "-"}{i.billing_period_from && i.billing_period_to ? ` · ${istDay.format(new Date(i.billing_period_from))}–${istDay.format(new Date(i.billing_period_to))}` : ""}</span></span>
                          <span className="text-right">{inr(Number(i.grand_total || 0))}<br /><span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: bg, color: fg }}>{statusLabel(i.invoice_status)}</span></span>
                        </li>
                      );
                    })}
                    {!liveInvoices.length && <li className="border-t border-line py-3 text-sm text-muted">No invoices yet.</li>}
                  </ul>
                </>
              )}
            </section>
          )}

          <section aria-labelledby="enq-h" className={card}>
            <div className="flex items-center justify-between">
              <h2 id="enq-h" className={widgetTitle}><Inbox aria-hidden="true" className="size-3.5" />Enquiries {newEnquiries > 0 && <span className="ml-1.5 rounded-full bg-accent-pale px-2 py-0.5 text-xs font-semibold text-accent">{newEnquiries} new</span>}</h2>
              <button type="button" onClick={() => setActiveModule("enquiries")} className="text-sm font-semibold text-accent hover:text-accent-hover">Open Enquiries</button>
            </div>
            <ul className="mt-3.5">
              {enquiries.slice(0, 3).map((e) => (
                <li key={e.id} className="border-t border-line py-3">
                  <div className="flex justify-between gap-2"><b className="truncate font-semibold">{e.name}</b><span className="shrink-0 text-xs text-muted">{when(e.created_at)}</span></div>
                  <p className="mt-1 truncate text-sm text-muted">{e.message}</p>
                </li>
              ))}
              {!enquiries.length && <li className="border-t border-line py-3 text-sm text-muted">No enquiries yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
