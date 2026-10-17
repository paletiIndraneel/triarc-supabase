"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Pencil, Plus, RefreshCw, Settings2, Trash2, X } from "lucide-react";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { confirmDialog } from "@/components/admin/confirmDialog";
import { invalidateCpoMobileNumbers } from "@/app/admin/cms/cpoNumbersCache";

type CpoNumber = { id: string; mobileNumber: string; normalizedMobile: string; createdAt: string; updatedAt: string };

export default function CpoSettings() {
  const { setActiveModule } = useAdminModule();
  const [numbers, setNumbers] = useState<CpoNumber[]>([]);
  const [mobileNumber, setMobileNumber] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldError, setFieldError] = useState("");

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
    event.preventDefault(); setError(""); setNotice("");
    if (!mobileNumber.trim()) { setFieldError("Enter a 10-digit mobile number."); document.getElementById("cpo-mobile")?.focus(); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/cpo-numbers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobileNumber }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not add number.");
      setMobileNumber(""); setNotice("Number added. CPO matching will use the updated list on dashboard refresh."); invalidateCpoMobileNumbers(); await loadNumbers();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add number."); }
    finally { setSaving(false); }
  }
  async function saveEdit(id: string) {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/cpo-numbers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, mobileNumber: editingValue }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not update number.");
      setEditingId(null); setEditingValue(""); setNotice("Number updated. Historical MTD CPO energy is recalculated from the current transaction feed on dashboard refresh."); invalidateCpoMobileNumbers(); await loadNumbers();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update number."); }
    finally { setSaving(false); }
  }
  async function removeNumber(number: CpoNumber) {
    if (!(await confirmDialog({ title: "Remove CPO number?", message: `Remove ${number.mobileNumber} from CPO matching? Sessions from this number will no longer count as CPO energy.`, confirmLabel: "Remove", danger: true }))) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/cpo-numbers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: number.id }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not remove number.");
      setNotice("Number removed. Historical MTD CPO energy is recalculated from the current transaction feed on dashboard refresh."); invalidateCpoMobileNumbers(); await loadNumbers();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not remove number."); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f8f9ff] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1100px]">
      <button type="button" onClick={() => setActiveModule("cms")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-violet-700"><ArrowLeft size={16}/> Back to CMS Dashboard</button>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-50 p-3 text-violet-700"><Settings2 size={23}/></div><div>
            <h1 className="text-2xl font-bold tracking-tight">CPO Settings</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Manage the mobile numbers used to identify CPO transactions. Updates are applied to historical transactions when dashboard summaries are refreshed.</p>
          </div></div>
          <button type="button" onClick={() => void loadNumbers()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "motion-safe:animate-spin" : ""}/> Refresh</button>
        </div>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
        <form onSubmit={submitNumber} className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <label htmlFor="cpo-mobile" className="block text-sm font-semibold text-slate-800">Add CPO mobile number</label>
          <p className="mt-1 text-xs leading-5 text-slate-500">Enter an Indian 10-digit mobile number. +91/0091 prefixes and spaces or hyphens are accepted. Equivalent formats are deduplicated.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input id="cpo-mobile" value={mobileNumber} onChange={(event) => { setMobileNumber(event.target.value); setFieldError(""); }} aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? "cpo-mobile-error" : undefined}
