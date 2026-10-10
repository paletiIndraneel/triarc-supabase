"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Pencil, Plus, RefreshCw, Settings2, Trash2, X } from "lucide-react";

type CpoNumber = { id: string; mobileNumber: string; normalizedMobile: string; createdAt: string; updatedAt: string };

export default function CpoSettingsPage() {
  const [numbers, setNumbers] = useState<CpoNumber[]>([]);
  const [mobileNumber, setMobileNumber] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadNumbers = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/cpo-numbers", { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as { numbers?: CpoNumber[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? (response.status === 403 ? "Administrator access is required." : "Could not load CPO settings."));
      setNumbers(data.numbers ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load CPO settings."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadNumbers(); }, [loadNumbers]);

  async function submitNumber(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/cpo-numbers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobileNumber }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not add number.");
      setMobileNumber(""); setNotice("Number added. CPO matching will use the updated list on dashboard refresh."); await loadNumbers();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add number."); }
    finally { setSaving(false); }
  }
  async function saveEdit(id: string) {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/cpo-numbers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, mobileNumber: editingValue }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not update number.");
      setEditingId(null); setEditingValue(""); setNotice("Number updated. Historical MTD CPO energy is recalculated from the current transaction feed on dashboard refresh."); await loadNumbers();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update number."); }
    finally { setSaving(false); }
  }
  async function removeNumber(number: CpoNumber) {
    if (!window.confirm(`Remove ${number.mobileNumber} from CPO matching? Historical CPO classification changes on dashboard refresh.`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/cpo-numbers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: number.id }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not remove number.");
      setNotice("Number removed. Historical MTD CPO energy is recalculated from the current transaction feed on dashboard refresh."); await loadNumbers();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not remove number."); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f8f9ff] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1100px]">
      <a href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-violet-700"><ArrowLeft size={16}/> Back to CMS Dashboard</a>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-50 p-3 text-violet-700"><Settings2 size={23}/></div><div>
            <h1 className="text-2xl font-bold tracking-tight">CPO Settings</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Manage the mobile numbers used to identify CPO transactions. Updates are applied to historical transactions when dashboard summaries are refreshed.</p>
          </div></div>
          <button type="button" onClick={() => void loadNumbers()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh</button>
        </div>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
        <form onSubmit={submitNumber} className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <label htmlFor="cpo-mobile" className="block text-sm font-semibold text-slate-800">Add CPO mobile number</label>
          <p className="mt-1 text-xs leading-5 text-slate-500">Enter an Indian 10-digit mobile number. +91/0091 prefixes and spaces or hyphens are accepted. Equivalent formats are deduplicated.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input id="cpo-mobile" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} placeholder="+91 98765 43210" autoComplete="tel" inputMode="tel" required className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"/>
            <button type="submit" disabled={saving || !mobileNumber.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><Plus size={16}/> Add number</button>
          </div>
        </form>
        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-bold">Configured numbers</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{numbers.length} number{numbers.length === 1 ? "" : "s"}</span></div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Saved mobile</span><span>Normalized match value</span><span>Actions</span></div>
            {loading ? <div className="px-4 py-10 text-center text-sm text-slate-500">Loading configured numbers…</div> : numbers.length === 0 ? <div className="px-4 py-10 text-center text-sm text-slate-500">No CPO mobile numbers configured yet.</div> : numbers.map((number) => <div key={number.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div className="min-w-0">{editingId === number.id ? <input value={editingValue} onChange={(event) => setEditingValue(event.target.value)} aria-label="Edit mobile number" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"/> : <span className="break-words text-sm font-semibold">{number.mobileNumber}</span>}</div>
              <span className="break-words font-mono text-xs text-slate-500">{number.normalizedMobile}</span>
              <div className="flex items-center justify-end gap-1">{editingId === number.id ? <>
                <button type="button" title="Save number" aria-label="Save number" disabled={saving} onClick={() => void saveEdit(number.id)} className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"><Check size={16}/></button>
                <button type="button" title="Cancel edit" aria-label="Cancel edit" onClick={() => { setEditingId(null); setEditingValue(""); }} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={16}/></button>
              </> : <>
                <button type="button" title="Edit number" aria-label={`Edit ${number.mobileNumber}`} disabled={saving} onClick={() => { setEditingId(number.id); setEditingValue(number.mobileNumber); }} className="rounded-md p-2 text-slate-600 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"><Pencil size={16}/></button>
                <button type="button" title="Remove number" aria-label={`Remove ${number.mobileNumber}`} disabled={saving} onClick={() => void removeNumber(number)} className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={16}/></button>
              </>}</div>
            </div>)}
          </div>
        </div>
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-blue-900"><p className="font-semibold">How matching works</p>
          <p className="mt-1">Formatting is normalized before matching. 9876543210, +91 98765-43210 and 91-9876543210 match the same 10-digit Indian mobile number. Transactions with missing or unmatched mobile numbers are non-CPO.</p>
          <p className="mt-1">CPO energy appears below DC in Total Energy (MTD). Revenue and Duration cards are unchanged.</p>
        </div>
      </section>
    </div>
  </main>;
}
