"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link2, MapPin, Pencil, Plus, RefreshCw, Unlink, X } from "lucide-react";
import { confirmDialog } from "@/components/admin/confirmDialog";
import { supabase } from "@/lib/supabase/billing";
import { PROVIDERS, providerLabel } from "@/lib/cms/providerIds";
import { displayLocation, groupStations, type StationRecord } from "@/app/admin/cms/transactionFilters";

// Stations and the charging-platform locations that feed them. billing_invoice_stations holds
// one record per station per platform (provider, location_id, location_name; empty until
// linked), and records with the same name are one station. Stations module (adminNavigation +
// RLS). New Bill counts a station's sessions through these records, so a new station or a new
// platform location is set up here, never in code. Nothing is deleted: unlinking empties a record.

type Row = StationRecord & { place_of_supply: string | null; state_code: string | null };
type Linked = Row & { provider: string; location_id: string };
type SeenLocation = { provider: string; location_id: string; location_name: string | null; sessions: number; last_session_at: string | null; station_id: string | null };
type NewLocation = { provider: string; location_id: string; location_name: string | null };
type DbResult = { error: { message: string; code?: string } | null };

const EMPTY_STATION = { name: "", place_of_supply: "", state_code: "" };
const EMPTY_LINK = { provider: null, location_id: null, location_name: null };
const inputClass = "min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50";
const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
const stationsTable = () => supabase.from("billing_invoice_stations");

export default function Stations() {
  const [records, setRecords] = useState<Row[]>([]);
  const [seen, setSeen] = useState<SeenLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(EMPTY_STATION);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [assign, setAssign] = useState<{ [key: string]: string }>({});
  const [manual, setManual] = useState({ provider: PROVIDERS[0]?.id ?? "", location_id: "", location_name: "", station: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [s, v] = await Promise.all([
      stationsTable().select("id, name, place_of_supply, state_code, active, provider, location_id, location_name").order("name"),
      supabase.from("session_locations").select("provider, location_id, location_name, sessions, last_session_at, station_id"),
    ]);
    const failed = [s, v].find((r) => r.error);
    if (failed?.error) setError(failed.error.message);
    else {
      setRecords((s.data ?? []) as Row[]);
      setSeen((v.data ?? []) as SeenLocation[]);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const key = (provider: string, locationId: string) => `${provider}|${locationId}`;
  const seenByKey = useMemo(() => new Map(seen.map((s) => [key(s.provider, s.location_id), s])), [seen]);
  const stations = useMemo(() => groupStations(records), [records]);
  const unassigned = seen.filter((s) => !s.station_id);
  const activeStations = stations.filter((s) => s.active);

  async function run(action: () => PromiseLike<DbResult>, done: string) {
    setSaving(true);
    setError("");
    setNotice("");
    const { error: e } = await action();
    if (e) setError(e.code === "23505" ? "That location is already linked to a station." : e.message);
    else {
      setNotice(done);
      await load();
    }
    setSaving(false);
  }

  async function saveStation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim(), place = form.place_of_supply.trim(), code = form.state_code.trim();
    if (!name || !place) return setError("Enter the station name and its place of supply.");
    if (!/^\d{2}$/.test(code)) return setError("The state code is the 2-digit GST state code, e.g. 36 for Telangana.");
    if (name !== editingName && stations.some((s) => s.name === name)) return setError("A station with that name already exists.");
    const value = { name, place_of_supply: place, state_code: code };
    const ids = stations.find((s) => s.name === editingName)?.ids;
    await run(
      // An edit changes every platform record of the station, so they never drift apart.
      () => ids ? stationsTable().update(value).in("id", ids) : stationsTable().insert({ ...value, active: true }),
      ids ? `${displayLocation(name)} updated.` : `${displayLocation(name)} added.`
    );
    setForm(EMPTY_STATION);
    setEditingName(null);
  }

  // Puts the location on the station's empty record, or on a new record copying the station's details.
  function linkTo(stationName: string, location: NewLocation): PromiseLike<DbResult> {
    const station = stations.find((s) => s.name === stationName);
    if (!station) return Promise.resolve({ error: { message: "That station no longer exists." } });
    const empty = station.records.find((r) => !r.provider);
    if (empty) return stationsTable().update(location).eq("id", empty.id);
    const { name, place_of_supply, state_code } = station.records[0];
    return stationsTable().insert({ name, place_of_supply, state_code, active: station.active, ...location });
  }

  function linkLocation(location: NewLocation, stationName: string) {
    if (!stationName) return setError("Pick the station this location belongs to.");
    return run(() => linkTo(stationName, location), `${providerLabel(location.provider)} location ${location.location_name ?? location.location_id} linked to ${displayLocation(stationName)}.`);
  }

  async function addManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const locationId = manual.location_id.trim();
    if (!manual.provider || !locationId) return setError("Enter the platform and its location id.");
    await linkLocation({ provider: manual.provider, location_id: locationId, location_name: manual.location_name.trim() || null }, manual.station);
    setManual((m) => ({ ...m, location_id: "", location_name: "" }));
  }

  async function unlink(link: Linked) {
    const ok = await confirmDialog({
      title: "Unlink location?",
      message: `Unlink ${providerLabel(link.provider)} location ${link.location_name ?? link.location_id}? Its sessions stay; New Bill stops counting them for this station until it is linked again.`,
      confirmLabel: "Unlink",
      danger: true,
    });
    if (ok) await run(() => stationsTable().update(EMPTY_LINK).eq("id", link.id), "Location unlinked.");
  }

  // Off this record first (a location may sit on one record only), then onto the other station;
  // if the second step fails the location shows under Unassigned to link again.
  function move(link: Linked, stationName: string) {
    return run(async () => {
      const off = await stationsTable().update(EMPTY_LINK).eq("id", link.id);
      return off.error ? off : linkTo(stationName, { provider: link.provider, location_id: link.location_id, location_name: link.location_name ?? null });
    }, `Location moved to ${displayLocation(stationName)}.`);
  }

  return <main className="min-h-screen bg-[#f8f9ff] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1100px] space-y-6">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-violet-50 p-3 text-violet-700"><MapPin size={23}/></div><div>
            <h1 className="text-2xl font-bold tracking-tight">Stations</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Each station lists the charging-platform locations that feed it. New Bill counts only the chosen station&apos;s sessions, so link every new location here.</p>
          </div></div>
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? "motion-safe:animate-spin" : ""}/> Refresh</button>
        </div>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        {unassigned.length > 0 && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-900">Unassigned locations</h2>
          <p className="mt-1 text-xs text-amber-800">Found in the charging sessions but not linked to a station. New Bill counts none of their sessions until they are.</p>
          <ul className="mt-3 space-y-2">{unassigned.map((loc) => {
            const k = key(loc.provider, loc.location_id);
            return <li key={k} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm">
              <span className="min-w-0 flex-1"><b>{providerLabel(loc.provider)}</b> · {loc.location_name ? displayLocation(loc.location_name) : "Unnamed"} <span className="font-mono text-xs text-slate-500">({loc.location_id})</span> · {loc.sessions} sessions</span>
              <select value={assign[k] ?? ""} onChange={(e) => setAssign((a) => ({ ...a, [k]: e.target.value }))} aria-label={`Station for ${loc.location_name ?? loc.location_id}`} className={inputClass}>
                <option value="">Pick station…</option>
                {activeStations.map((s) => <option key={s.name} value={s.name}>{displayLocation(s.name)}</option>)}
              </select>
              <button type="button" disabled={saving} onClick={() => void linkLocation(loc, assign[k] ?? "")} className={buttonClass}><Link2 size={15}/> Link</button>
            </li>;
          })}</ul>
        </div>}

        <div className="mt-7 space-y-4">
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading stations…</p> : stations.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No stations yet. Add the first one below.</p> : stations.map((station) => {
            const stationLinks = station.records.filter((r): r is Linked => Boolean(r.provider && r.location_id));
            const first = station.records[0];
            return <article key={station.name} className={`rounded-xl border p-4 ${station.active ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-75"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">{displayLocation(station.name)}{!station.active && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">Inactive</span>}</h2>
                  <p className="text-xs text-slate-500">Place of supply {first.place_of_supply ?? "—"} · state code {first.state_code ?? "—"}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={saving} onClick={() => { setEditingName(station.name); setForm({ name: station.name, place_of_supply: first.place_of_supply ?? "", state_code: first.state_code ?? "" }); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Pencil size={13}/> Edit</button>
                  <button type="button" disabled={saving} onClick={() => void run(() => stationsTable().update({ active: !station.active }).in("id", station.ids), `${displayLocation(station.name)} ${station.active ? "turned off" : "turned on"}.`)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{station.active ? "Turn off" : "Turn on"}</button>
                </div>
              </div>
              {stationLinks.length === 0 ? <p className="mt-3 text-sm text-amber-700">No platform location linked: New Bill finds no sessions for this station.</p> : <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">{stationLinks.map((link) => {
                const stats = seenByKey.get(key(link.provider, link.location_id));
                return <li key={link.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1"><b>{providerLabel(link.provider)}</b> · {link.location_name ? displayLocation(link.location_name) : "Unnamed"} <span className="font-mono text-xs text-slate-500">({link.location_id})</span>
                    <span className="text-slate-500"> · {stats ? `${stats.sessions} sessions, last ${stats.last_session_at ? dateFmt.format(new Date(stats.last_session_at)) : "—"}` : "no sessions yet"}</span></span>
                  <select value="" disabled={saving} onChange={(e) => e.target.value && void move(link, e.target.value)} aria-label={`Move ${link.location_name ?? link.location_id} to another station`} className={inputClass}>
                    <option value="">Move to…</option>
                    {activeStations.filter((s) => s.name !== station.name).map((s) => <option key={s.name} value={s.name}>{displayLocation(s.name)}</option>)}
                  </select>
                  <button type="button" title="Unlink location" aria-label={`Unlink ${link.location_name ?? link.location_id}`} disabled={saving} onClick={() => void unlink(link)} className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Unlink size={16}/></button>
                </li>;
              })}</ul>}
            </article>;
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveStation} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-base font-bold">{editingName ? "Edit station" : "Add station"}</h2>
            {editingName && <button type="button" onClick={() => { setEditingName(null); setForm(EMPTY_STATION); }} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><X size={14}/> Cancel</button>}</div>
          <p className="mt-1 text-xs text-slate-500">The name, place of supply and state code are printed on the station&apos;s invoices as written (CGST+SGST for 36 Telangana customers, else IGST). The admin shows the name without &quot;Triarc EV hub |&quot;.</p>
          <div className="mt-3 grid gap-3">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name as printed on invoices, e.g. Triarc EV hub | Bhadrachalam" aria-label="Station name" className={inputClass}/>
            <input value={form.place_of_supply} onChange={(e) => setForm((f) => ({ ...f, place_of_supply: e.target.value }))} placeholder="Place of supply, e.g. Bhadrachalam-Telangana" aria-label="Place of supply" className={inputClass}/>
            <input value={form.state_code} onChange={(e) => setForm((f) => ({ ...f, state_code: e.target.value }))} placeholder="State code, e.g. 36" inputMode="numeric" maxLength={2} aria-label="GST state code" className={inputClass}/>
            <button type="submit" disabled={saving} className={buttonClass}><Plus size={15}/> {editingName ? "Save station" : "Add station"}</button>
          </div>
        </form>

        <form onSubmit={addManual} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold">Link a location by id</h2>
          <p className="mt-1 text-xs text-slate-500">For a location that has no sessions yet (a new charger, or a test). Locations with sessions appear under Unassigned by themselves.</p>
          <div className="mt-3 grid gap-3">
            <select value={manual.provider} onChange={(e) => setManual((m) => ({ ...m, provider: e.target.value }))} aria-label="Platform" className={inputClass}>
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input value={manual.location_id} onChange={(e) => setManual((m) => ({ ...m, location_id: e.target.value }))} placeholder="Platform location id" aria-label="Platform location id" className={inputClass}/>
            <input value={manual.location_name} onChange={(e) => setManual((m) => ({ ...m, location_name: e.target.value }))} placeholder="Location name (optional)" aria-label="Location name" className={inputClass}/>
            <select value={manual.station} onChange={(e) => setManual((m) => ({ ...m, station: e.target.value }))} aria-label="Station" className={inputClass}>
              <option value="">Pick station…</option>
              {activeStations.map((s) => <option key={s.name} value={s.name}>{displayLocation(s.name)}</option>)}
            </select>
            <button type="submit" disabled={saving} className={buttonClass}><Link2 size={15}/> Link location</button>
          </div>
        </form>
      </section>
    </div>
  </main>;
}
