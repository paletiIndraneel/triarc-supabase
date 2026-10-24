"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { displayLocation, groupStations } from "@/app/admin/cms/transactionFilters";
import { hasFullAccess, isEmail, type AccessLevel } from "@/lib/adminAccess";

// Who can open the admin and what they see. Full-access admins only (adminNavigation + the
// /api/admin/access checks). Partners and IT admins see everything; any other role opens the
// modules ticked here, for all stations or only the ones picked.

type Level = { id: AccessLevel; label: string; full: boolean };
type ModuleOption = { key: string; label: string };
type StationRow = { id: string; name: string; active: boolean };
type Admin = { user_id: string; email: string; access: AccessLevel; active: boolean; created_at: string; modules: string[]; stationIds: string[] };
type Draft = { access: AccessLevel; active: boolean; modules: string[]; stationIds: string[] };
type Station = { name: string; ids: string[]; active: boolean };

const DEFAULT_MODULES = ["overview", "cms", "enquiries"];
const inputClass = "rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-focus-ring/25";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-50";
const sameSet = (a: string[], b: string[]) => a.slice().sort().join() === b.slice().sort().join();

function ModulePicker({ options, value, onChange, disabled }: { options: ModuleOption[]; value: string[]; onChange: (keys: string[]) => void; disabled?: boolean }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <legend className="sr-only">Modules</legend>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Modules</span>
      <span className="text-muted">Overview</span>
      {options.map((m) => (
        <label key={m.key} className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={value.includes(m.key)} disabled={disabled}
            onChange={(e) => onChange(e.target.checked ? [...value, m.key] : value.filter((k) => k !== m.key))}/>
          {m.label}
        </label>
      ))}
    </fieldset>
  );
}

// A dropdown of check boxes. Nothing picked = all stations. A station's platform records are
// picked together.
function StationPicker({ stations, value, onChange, disabled }: { stations: Station[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const picked = stations.filter((s) => s.ids.some((id) => value.includes(id)));
  const summary = picked.length ? picked.map((s) => displayLocation(s.name)).join(", ") : "All stations";
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Stations</span>
      <details className="group relative">
        <summary className={`${inputClass} flex min-w-[220px] cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden ${disabled ? "pointer-events-none opacity-50" : ""}`}>
          <span className="truncate">{summary}</span><ChevronDown size={15} className="shrink-0 text-muted transition group-open:rotate-180"/>
        </summary>
        <div className="absolute z-10 mt-1 grid min-w-[220px] gap-1 rounded-lg border border-line bg-surface p-2 shadow-lg">
          <label className="inline-flex items-center gap-2 rounded px-2 py-1 hover:bg-raised"><input type="checkbox" checked={picked.length === 0} onChange={() => onChange([])}/> All stations</label>
          {stations.map((s) => {
            const on = s.ids.some((id) => value.includes(id));
            return (
              <label key={s.name} className={`inline-flex items-center gap-2 rounded px-2 py-1 hover:bg-raised ${s.active ? "" : "text-muted"}`}>
                <input type="checkbox" checked={on}
                  onChange={() => onChange(on ? value.filter((id) => !s.ids.includes(id)) : [...value, ...s.ids])}/>
                {displayLocation(s.name)}{s.active ? "" : " (off)"}
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}

async function readAdmins() {
  try {
    const response = await fetch("/api/admin/access", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? (response.status === 403 ? "Only partners and IT admins can manage access." : "Could not load admins."));
    return { data, error: "" };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Could not load admins." };
  }
}

export default function Access() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [moduleOptions, setModuleOptions] = useState<ModuleOption[]>([]);
  const [stationRows, setStationRows] = useState<StationRow[]>([]);
  const [me, setMe] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [invite, setInvite] = useState<{ email: string; access: AccessLevel; modules: string[]; stationIds: string[] }>({ email: "", access: "", modules: DEFAULT_MODULES, stationIds: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const stations = useMemo(() => groupStations(stationRows), [stationRows]);

  const show = useCallback(({ data, error }: Awaited<ReturnType<typeof readAdmins>>) => {
    if (error) {
      setError(error);
    } else {
      setAdmins(data.admins);
      setLevels(data.levels);
      setModuleOptions(data.modules);
      // The invite starts on the first role without full access (the picklist decides the roles).
      const levelsNow = data.levels as Level[];
      setInvite((i) => (i.access ? i : { ...i, access: (levelsNow.find((l) => !l.full) ?? levelsNow[0])?.id ?? "" }));
      setStationRows(data.stations);
      setMe(data.me);
      setDrafts(Object.fromEntries((data.admins as Admin[]).map((a) => [a.user_id, { access: a.access, active: a.active, modules: a.modules, stationIds: a.stationIds }])));
    }
    setLoading(false);
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    show(await readAdmins());
  }, [show]);
  // On mount loading is already true and error empty, so the first read only shows its result.
  useEffect(() => {
    let current = true;
    void readAdmins().then((result) => { if (current) show(result); });
    return () => { current = false; };
  }, [show]);

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
    if (ok) setInvite((i) => ({ ...i, email: "", modules: DEFAULT_MODULES, stationIds: [] }));
  }

  const changed = (a: Admin) => {
    const d = drafts[a.user_id];
    return d && (d.access !== a.access || d.active !== a.active || !sameSet(d.modules, a.modules) || !sameSet(d.stationIds, a.stationIds));
  };

  return <main className="min-h-screen bg-page px-4 py-8 text-ink sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1100px] space-y-6">
      <section className="rounded-2xl border border-line/80 bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-accent-pale p-3 text-accent"><ShieldCheck size={23}/></div><div>
            <h1 className="text-2xl font-bold tracking-tight">Access</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Partners and IT admins see and manage everything. Other admins open the modules ticked for them, for all stations or only the ones picked.</p>
          </div></div>
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-raised disabled:opacity-50"><RefreshCw size={15} className={loading ? "motion-safe:animate-spin" : ""}/> Refresh</button>
        </div>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <div className="mt-6 space-y-3">
          {loading ? <p className="py-8 text-center text-sm text-muted">Loading admins…</p> : admins.map((a) => {
            const d = drafts[a.user_id] ?? { access: a.access, active: a.active, modules: a.modules, stationIds: a.stationIds };
            const setDraft = (patch: Partial<Draft>) => setDrafts((all) => ({ ...all, [a.user_id]: { ...d, ...patch } }));
            const self = a.user_id === me;
            return <article key={a.user_id} className={`rounded-xl border p-4 ${a.active ? "border-line" : "border-line bg-raised"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.email || a.user_id}{self && <span className="ml-2 rounded-full bg-accent-pale px-2 py-0.5 text-xs font-semibold text-accent">You</span>}</p>
                  <p className="text-xs text-muted">Admin since {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <select value={d.access} disabled={saving} onChange={(e) => setDraft({ access: e.target.value as AccessLevel })} aria-label={`Access level for ${a.email}`} className={inputClass}>
                  {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                <label className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={d.active} disabled={saving} onChange={(e) => setDraft({ active: e.target.checked })}/> Active</label>
                <button type="button" disabled={saving || !changed(a)} onClick={() => void send("PATCH", { userId: a.user_id, ...d }, `${a.email || "Admin"} updated.`)} className={buttonClass}>Save</button>
              </div>
              <div className="mt-3 grid gap-3 border-t border-line pt-3">
                {hasFullAccess(d.access)
                  ? <p className="text-sm text-muted">Sees every module and every station.</p>
                  : <>
                    <ModulePicker options={moduleOptions} value={d.modules} disabled={saving} onChange={(modules) => setDraft({ modules })}/>
                    <StationPicker stations={stations} value={d.stationIds} disabled={saving} onChange={(ids) => setDraft({ stationIds: ids })}/>
                  </>}
              </div>
            </article>;
          })}
        </div>
      </section>

      <form onSubmit={sendInvite} className="rounded-2xl border border-line/80 bg-surface p-5 shadow-sm sm:p-7">
        <h2 className="text-base font-bold">Invite an admin</h2>
        <p className="mt-1 text-xs text-muted">They get an email from Supabase with a link to set their password. The link signs them in once.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <input type="email" value={invite.email} onChange={(e) => setInvite((i) => ({ ...i, email: e.target.value }))} placeholder="name@example.com" aria-label="Email to invite" autoComplete="off" className={`${inputClass} min-w-[240px] flex-1`}/>
          <select value={invite.access} onChange={(e) => setInvite((i) => ({ ...i, access: e.target.value as AccessLevel }))} aria-label="Access level for the invite" className={inputClass}>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <button type="submit" disabled={saving || !levels.length} className={buttonClass}><Mail size={15}/> Send invite</button>
        </div>
        {!hasFullAccess(invite.access) && <div className="mt-3 grid gap-3">
          <ModulePicker options={moduleOptions} value={invite.modules} disabled={saving} onChange={(modules) => setInvite((i) => ({ ...i, modules }))}/>
          <StationPicker stations={stations} value={invite.stationIds} disabled={saving} onChange={(ids) => setInvite((i) => ({ ...i, stationIds: ids }))}/>
        </div>}
      </form>
    </div>
  </main>;
}
