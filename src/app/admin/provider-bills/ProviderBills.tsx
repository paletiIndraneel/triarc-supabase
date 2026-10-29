"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ReceiptText, RefreshCw } from "lucide-react";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { confirmDialog } from "@/components/admin/confirmDialog";
import type { CycleRule } from "@/lib/billingCycle";

// Platform bills: what the charging platform says Triarc owes for a cycle, beside what the
// stored sessions say. Ionage auto-generates its bill and emails it, so this is where the
// quantities get checked before anyone agrees them.
//
// Every admin with the module reads. Only full access records or confirms, which the API and
// RLS enforce too; `canConfirm` only decides what is shown.

type Ours = { sessions: number; energyKwh: number; cpoEnergyKwh: number; amount: number; commission: number };
type Bill = {
  id: string; paymentDue: string | null; theirEnergyKwh: number | null; theirAmount: number | null;
  theirCommission: number | null; status: string; note: string | null; confirmedAt: string | null;
};
type Row = { periodStart: string; periodEnd: string; label: string; running: boolean; ours: Ours; bill: Bill | null };
type Data = {
  provider: { id: string; label: string; cycle: CycleRule; commissionPerKwh: number };
  canConfirm: boolean; cycles: Row[];
};

const kwh = (value: number | null) =>
  value == null ? "—" : `${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`;
const money = (value: number | null) =>
  value == null ? "—" : `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

// A gap worth looking at. AC meters drift by hundredths of a kWh; anything past this is a
// disagreement, not drift.
const DRIFT_KWH = 0.5;

async function readBills(provider?: string): Promise<{ data: Data | null; error: string }> {
  try {
    const query = provider ? `?provider=${encodeURIComponent(provider)}` : "";
    const response = await fetch(`/api/admin/provider-bills${query}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({})) as Partial<Data> & { error?: string };
    if (!response.ok) throw new Error(body.error ?? (response.status === 403 ? "Administrator access is required." : "Could not load platform bills."));
    return { data: body as Data, error: "" };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Could not load platform bills." };
  }
}

export default function ProviderBills() {
  const { setActiveModule } = useAdminModule();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ theirEnergyKwh: "", theirAmount: "", theirCommission: "", note: "" });

  const show = useCallback(({ data, error }: Awaited<ReturnType<typeof readBills>>) => {
    if (error) setError(error); else setData(data);
    setLoading(false);
  }, []);
  const loadBills = useCallback(async () => {
    setLoading(true); setError("");
    show(await readBills(data?.provider.id));
  }, [show, data?.provider.id]);
  // On mount loading is already true and error empty, so the first read only shows its result.
  useEffect(() => {
    let current = true;
    void readBills().then((result) => { if (current) show(result); });
    return () => { current = false; };
  }, [show]);

  function startEditing(row: Row) {
    setEditing(row.periodStart);
    setNotice(""); setError("");
    setForm({
      theirEnergyKwh: row.bill?.theirEnergyKwh?.toString() ?? "",
      theirAmount: row.bill?.theirAmount?.toString() ?? "",
      theirCommission: row.bill?.theirCommission?.toString() ?? "",
      note: row.bill?.note ?? "",
    });
  }

  async function save(row: Row, status: "pending" | "confirmed" | "disputed") {
    if (!data) return;
    if (status === "confirmed") {
      const gap = form.theirEnergyKwh.trim() ? Math.abs(Number(form.theirEnergyKwh) - row.ours.energyKwh) : null;
      const ok = await confirmDialog({
        title: `Confirm the ${data.provider.label} bill for ${row.label}?`,
        message: gap != null && gap > DRIFT_KWH
          ? `Their energy differs from ours by ${gap.toFixed(2)} kWh, which is more than meter drift. Confirming records that Triarc agrees this bill.`
          : "Confirming records that Triarc agrees this bill and will pay it.",
        confirmLabel: "Confirm the bill",
        danger: gap != null && gap > DRIFT_KWH,
      });
      if (!ok) return;
    }
    setSaving(row.periodStart); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/provider-bills", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: data.provider.id, periodStart: row.periodStart, status,
          theirEnergyKwh: form.theirEnergyKwh, theirAmount: form.theirAmount,
          theirCommission: form.theirCommission, note: form.note,
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not save the bill.");
      setNotice(status === "confirmed" ? `${row.label} confirmed.` : `${row.label} saved as ${status}.`);
      setEditing(null);
      await loadBills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the bill.");
    } finally {
      setSaving("");
    }
  }

  const field = (label: string, key: keyof typeof form, hint: string) => (
    <label className="block">
      <span className="block text-xs font-semibold text-ink">{label}</span>
      <input
        value={form[key]}
        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
        inputMode="decimal"
        placeholder={hint}
        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-focus-ring/25"
      />
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <button type="button" onClick={() => setActiveModule("cms")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-accent"><ArrowLeft size={16}/> Back to CMS Dashboard</button>
      <section className="rounded-2xl border border-line/80 bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-accent-pale p-3 text-accent"><ReceiptText size={23}/></div><div>
            <h1 className="text-2xl font-bold tracking-tight">Platform Bills</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              What {data?.provider.label ?? "the charging platform"} bills Triarc each cycle, beside the same cycle worked out from the stored sessions. Key in the figures from their document, then confirm or dispute.
            </p>
          </div></div>
          <button type="button" onClick={() => void loadBills()} disabled={loading || !!saving} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-raised disabled:opacity-50"><RefreshCw size={15} className={loading ? "motion-safe:animate-spin" : ""}/> Refresh</button>
        </div>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        {data && data.provider.commissionPerKwh > 0 && (
          <p className="mt-5 text-xs leading-5 text-muted">
            Our commission is worked out at {money(data.provider.commissionPerKwh)} per kWh of customer energy, Triarc&apos;s own CPO sessions excluded.
          </p>
        )}

        <ul className="mt-6 space-y-3">
          {(data?.cycles ?? []).map((row) => {
            const gap = row.bill?.theirEnergyKwh != null ? row.bill.theirEnergyKwh - row.ours.energyKwh : null;
            const wide = gap != null && Math.abs(gap) > DRIFT_KWH;
            return (
              <li key={row.periodStart} className="rounded-xl border border-line bg-raised p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <p className="text-base font-bold tracking-tight text-ink">{row.label}</p>
                      {row.running
                        ? <span className="rounded-md bg-soft px-2 py-0.5 text-[11px] font-bold tracking-wide text-muted">RUNNING</span>
                        : <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${
                            row.bill?.status === "confirmed" ? "bg-emerald-100 text-emerald-800"
                            : row.bill?.status === "disputed" ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-800"}`}>
                            {(row.bill?.status ?? "pending").toUpperCase()}
                          </span>}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {day(row.periodStart)} to {day(new Date(Date.parse(row.periodEnd) - 86400000).toISOString())}
                      {row.bill?.paymentDue ? ` · payment due ${day(row.bill.paymentDue)}` : ""}
                      {row.bill?.confirmedAt ? ` · confirmed ${day(row.bill.confirmedAt)}` : ""}
                    </p>
                  </div>
                  {data?.canConfirm && !row.running && (
                    <button type="button" onClick={() => (editing === row.periodStart ? setEditing(null) : startEditing(row))}
                      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-soft">
                      {editing === row.periodStart ? "Close" : row.bill ? "Edit" : "Enter their bill"}
                    </button>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted">Our energy</dt><dd className="font-semibold tabular-nums text-ink">{kwh(row.ours.energyKwh)}</dd></div>
                  <div><dt className="text-xs text-muted">Their energy</dt><dd className={`font-semibold tabular-nums ${wide ? "text-red-700" : "text-ink"}`}>{kwh(row.bill?.theirEnergyKwh ?? null)}</dd></div>
                  <div><dt className="text-xs text-muted">Our commission</dt><dd className="font-semibold tabular-nums text-ink">{money(row.ours.commission)}</dd></div>
                  <div><dt className="text-xs text-muted">Their commission</dt><dd className="font-semibold tabular-nums text-ink">{money(row.bill?.theirCommission ?? null)}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-muted">
                  {row.ours.sessions} sessions · customer revenue {money(row.ours.amount)}
                  {row.ours.cpoEnergyKwh > 0 ? ` · our own CPO use ${kwh(row.ours.cpoEnergyKwh)}, not billable` : ""}
                  {gap != null ? ` · difference ${gap > 0 ? "+" : ""}${gap.toFixed(2)} kWh${wide ? " — worth checking" : " (within meter drift)"}` : ""}
                </p>
                {row.bill?.note && <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs leading-5 text-muted">{row.bill.note}</p>}

                {editing === row.periodStart && (
                  <div className="mt-4 rounded-xl border border-line bg-surface p-4">
                    <p className="text-xs leading-5 text-muted">From their document. Leave a figure empty if it is not stated.</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {field("Their energy (kWh)", "theirEnergyKwh", "0.00")}
                      {field("Their amount (₹)", "theirAmount", "0.00")}
                      {field("Their commission (₹)", "theirCommission", "0.00")}
                    </div>
                    <label className="mt-3 block">
                      <span className="block text-xs font-semibold text-ink">Note</span>
                      <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={2}
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-focus-ring/25"/>
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={!!saving} onClick={() => void save(row, "confirmed")}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">
                        {saving === row.periodStart ? "Saving…" : "Confirm"}
                      </button>
                      <button type="button" disabled={!!saving} onClick={() => void save(row, "disputed")}
                        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-soft disabled:opacity-50">Dispute</button>
                      <button type="button" disabled={!!saving} onClick={() => void save(row, "pending")}
                        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-soft disabled:opacity-50">Save only</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!loading && !error && !data?.cycles.length && <p className="mt-7 text-sm text-muted">No platform bills yet.</p>}
      </section>
    </div>
  );
}
