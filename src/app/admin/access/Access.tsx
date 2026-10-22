"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { displayLocation } from "@/app/admin/cms/transactionFilters";
import { hasFullAccess, isEmail, type AccessLevel } from "@/lib/adminAccess";

// Who can open the admin and what they see. Full-access admins only (adminNavigation + the
// /api/admin/access checks). Partners and IT admins see everything; an investor sees the CMS
// dashboard and enquiries, for all stations or only the ones ticked here.

type Level = { id: AccessLevel; label: string; full: boolean };
type Station = { id: string; name: string; active: boolean };
type Admin = { user_id: string; email: string; access: AccessLevel; active: boolean; created_at: string; stationIds: string[] };
type Draft = { access: AccessLevel; active: boolean; stationIds: string[] };

const inputClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50";

// "All stations" = no ticks. Ticking stations limits an investor to them.
function StationPicker({ stations, value, onChange, disabled }: { stations: Station[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={value.length === 0} disabled={disabled} onChange={() => onChange([])}/> All stations</label>
      {stations.map((s) => (
        <label key={s.id} className={`inline-flex items-center gap-1.5 ${s.active ? "" : "text-slate-400"}`}>
          <input type="checkbox" checked={value.includes(s.id)} disabled={disabled}
            onChange={(e) => onChange(e.target.checked ? [...value, s.id] : value.filter((id) => id !== s.id))}/>
          {displayLocation(s.name)}{s.active ? "" : " (off)"}
        </label>
      ))}
    </div>
  );
}

export default function Access() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [me, setMe] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [invite, setInvite] = useState<{ email: string; access: AccessLevel; stationIds: string[] }>({ email: "", access: "investor", stationIds: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/access", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? (response.status === 403 ? "Only partners and IT admins can manage access." : "Could not load admins."));
      setAdmins(data.admins);
      setLevels(data.levels);
      setStations(data.stations);
      setMe(data.me);
      setDrafts(Object.fromEntries((data.admins as Admin[]).map((a) => [a.user_id, { access: a.access, active: a.active, stationIds: a.stationIds }])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load admins.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(method: "POST" | "PATCH", body: unknown, done: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/access", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "The change could not be saved.");
      setNotice(done);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The change could not be saved.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEmail(invite.email)) return setError("Enter a valid email address.");
    const ok = await send("POST", invite, `Invite sent to ${invite.email.trim()}. They set a password from the link in the email.`);
    if (ok) setInvite({ email: "", access: "investor", stationIds: [] });
  }

  const changed = (a: Admin) => {
    const d = drafts[a.user_id];
    return d && (d.access !== a.access || d.active !== a.active || d.stationIds.slice().sort().join() !== a.stationIds.slice().sort().join());
  };

  return <main className="min-h-screen bg-[#f8f9ff] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1100px] space-y-6">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-50 p-3 text-violet-700"><ShieldCheck size={23}/></div><div>
            <h1 className="text-2xl font-bold tracking-tight">Access</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Partners and IT admins see and manage everything. Investors see the CMS dashboard and enquiries, for all stations or only the ones ticked.</p>
          </div></div>
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "motion-safe:animate-spin" : ""}/> Refresh</button>
        </div>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <div className="mt-6 space-y-3">
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading admins…</p> : admins.map((a) => {
            const d = drafts[a.user_id] ?? { access: a.access, active: a.active, stationIds: a.stationIds };
            const setDraft = (patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [a.user_id]: { ...d, ...patch } }));
            const self = a.user_id === me;
            return <article key={a.user_id} className={`rounded-xl border p-4 ${a.active ? "border-slate-200" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.email || a.user_id}{self && <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">You</span>}</p>
                  <p className="text-xs text-slate-500">Admin since {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <select value={d.access} disabled={saving} onChange={(e) => setDraft({ access: e.target.value as AccessLevel })} aria-label={`Access level for ${a.email}`} className={inputClass}>
                  {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                <label className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={d.active} disabled={saving} onChange={(e) => setDraft({ active: e.target.checked })}/> Active</label>
                <button type="button" disabled={saving || !changed(a)} onClick={() => void send("PATCH", { userId: a.user_id, ...d }, `${a.email || "Admin"} updated.`)} className={buttonClass}>Save</button>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                {hasFullAccess(d.access)
                  ? <p className="text-sm text-slate-500">Sees every module and every station.</p>
                  : <StationPicker stations={stations} value={d.stationIds} disabled={saving} onChange={(ids) => setDraft({ stationIds: ids })}/>}
              </div>
            </article>;
          })}
        </div>
      </section>

      <form onSubmit={sendInvite} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-base font-bold">Invite an admin</h2>
        <p className="mt-1 text-xs text-slate-500">They get an email from Supabase with a link to set their password. The link signs them in once.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <input type="email" value={invite.email} onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))} placeholder="name@example.com" aria-label="Email to invite" autoComplete="off" className={`${inputClass} min-w-[240px] flex-1`}/>
          <select value={invite.access} onChange={(e) => setInvite((i) => ({ ...i, access: e.target.value as AccessLevel }))} aria-label="Access level for the invite" className={inputClass}>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <button type="submit" disabled={saving} className={buttonClass}><Mail size={15}/> Send invite</button>
        </div>
        {!hasFullAccess(invite.access) && <div className="mt-3"><StationPicker stations={stations} value={invite.stationIds} disabled={saving} onChange={(ids) => setInvite((i) => ({ ...i, stationIds: ids }))}/></div>}
      </form>
    </div>
  </main>;
}
