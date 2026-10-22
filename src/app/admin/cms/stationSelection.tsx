"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase/billing";
import { ALL_STATIONS, displayLocation, filterByStation, stationLocationKey } from "./transactionFilters";

// The station selector shared by the CMS dashboard and Overview: one choice for the tab, kept in
// this browser. Stations come from billing_invoice_stations + station_locations (Stations page);
// only stations with a linked platform location are offered, and "All stations" shows everything,
// including sessions from locations not linked yet.

export type StationOption = { id: string; name: string };
type StationData = { options: StationOption[]; stationOfLocation: Map<string, string> };

const STORAGE_KEY = "triarc-admin-station";
const EMPTY: StationData = { options: [], stationOfLocation: new Map() };
let memo: Promise<StationData> | null = null;

function loadStations(): Promise<StationData> {
  memo ??= (async () => {
    const [stations, links] = await Promise.all([
      supabase.from("billing_invoice_stations").select("id, name"),
      supabase.from("station_locations").select("station_id, provider, location_id"),
    ]);
    if (stations.error || links.error) {
      memo = null; // don't keep a failed answer
      return EMPTY;
    }
    const stationOfLocation = new Map(links.data.map((l) => [stationLocationKey(l.provider, l.location_id), l.station_id as string]));
    const linked = new Set(stationOfLocation.values());
    const options = stations.data
      .filter((s) => linked.has(s.id))
      .map((s) => ({ id: s.id as string, name: displayLocation(s.name as string) }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
    >
      <option value={ALL_STATIONS}>All stations</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}
