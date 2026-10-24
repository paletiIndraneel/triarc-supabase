"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase/billing";
import { ALL_STATIONS, displayLocation, filterByStation, groupStations, stationLocationKey } from "./transactionFilters";

// The station selector shared by the CMS dashboard and Overview: one choice for the tab, kept in
// this browser. Stations come from billing_invoice_stations: one record per station per
// platform, grouped by name (Stations page); a station's id here is its name.
// Offered: active stations with a linked platform location, and for a station-limited investor
// only their own stations; with fewer than two to choose from the selector is hidden. "All
// stations" shows everything the admin may see, including locations not linked yet.

export type StationOption = { id: string; name: string };
type StationData = { options: StationOption[]; stationOfLocation: Map<string, string> };

const STORAGE_KEY = "triarc-admin-station";
const EMPTY: StationData = { options: [], stationOfLocation: new Map() };
let memo: Promise<StationData> | null = null;

function loadStations(): Promise<StationData> {
  memo ??= (async () => {
    const userId = (await supabase.auth.getSession()).data.session?.user.id ?? "";
    const [stations, mine] = await Promise.all([
      supabase.from("billing_invoice_stations").select("id, name, active, provider, location_id"),
      supabase.from("admin_users").select("station_ids").eq("user_id", userId).maybeSingle(),
    ]);
    if (stations.error || mine.error) {
      memo = null; // don't keep a failed answer
      return EMPTY;
    }
    const records = stations.data.filter((s) => s.active && s.provider && s.location_id);
    const stationOfLocation = new Map(records.map((s) => [stationLocationKey(s.provider, s.location_id), s.name as string]));
    const own = (mine.data?.station_ids as string[] | null) ?? [];
    const limitedTo = own.length ? new Set(own) : null;
    const options = groupStations(records)
      .filter((g) => !limitedTo || g.ids.some((id) => limitedTo.has(id)))
      .map((g) => ({ id: g.name, name: displayLocation(g.name) }));
    return { options, stationOfLocation };
  })();
  return memo;
}

// The choice, shared by every component on the page.
let selected = ALL_STATIONS;
try {
  if (typeof window !== "undefined") selected = window.localStorage.getItem(STORAGE_KEY) ?? ALL_STATIONS;
} catch {
  // storage blocked: keep "all"
}
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useStationSelection() {
  const [data, setData] = useState<StationData>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    void loadStations().then((d) => !cancelled && setData(d));
    return () => {
      cancelled = true;
    };
  }, []);
  const current = useSyncExternalStore(subscribe, () => selected, () => ALL_STATIONS);
  // A remembered station that no longer exists (or is not offered) falls back to all.
  const stationId = current === ALL_STATIONS || data.options.some((o) => o.id === current) ? current : ALL_STATIONS;

  const setStation = useCallback((id: string) => {
    selected = id;
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    for (const listener of listeners) listener();
  }, []);

  // Narrows a CMS window (stored + live sessions) to the chosen station.
  const filterCache = useCallback(
    <C extends { transactions: S[]; active?: { transactions?: S[]; count?: number } }, S extends { provider?: string; locationId?: number | string | null }>(cache: C): C => {
      if (stationId === ALL_STATIONS) return cache;
      const active = cache.active?.transactions ? filterByStation(cache.active.transactions, data.stationOfLocation, stationId) : undefined;
      return {
        ...cache,
        transactions: filterByStation(cache.transactions, data.stationOfLocation, stationId),
        active: cache.active && { ...cache.active, ...(active ? { transactions: active, count: active.length } : {}) },
      };
    },
    [stationId, data.stationOfLocation]
  );

  const stationName = useMemo(() => data.options.find((o) => o.id === stationId)?.name ?? null, [data.options, stationId]);
  return { options: data.options, stationId, stationName, setStation, filterCache };
}

// Shown only when there is more than one station to choose from.
export function StationSelect({ options, stationId, onChange }: { options: StationOption[]; stationId: string; onChange: (id: string) => void }) {
  if (options.length < 2) return null;
  return (
    <select
      value={stationId}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Station"
      className="rounded-lg border border-line bg-raised px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-2 focus:ring-focus-ring/25"
    >
      <option value={ALL_STATIONS}>All stations</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}
