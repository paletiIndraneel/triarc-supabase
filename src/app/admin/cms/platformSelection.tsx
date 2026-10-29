"use client";

import { useCallback, useSyncExternalStore } from "react";
import { providerLabel } from "@/lib/cms/providerIds";
import { cycleRuleFor, type CycleRule } from "@/lib/billingCycle";

// The charging platform the cards belong to, shared by the CMS dashboard and Overview, kept in
// this browser like the station choice.
//
// There is deliberately no "all platforms": every platform bills on its own cycle (ChargeMOD in
// half-months, Ionage every 7 days), so a total summed across two of them would match no bill
// and no reality. With more than one platform live a choice has to be made; with one it is
// implied and the selector is hidden.

const STORAGE_KEY = "triarc-admin-platform";

let selected: string | null = null;
try {
  if (typeof window !== "undefined") selected = window.localStorage.getItem(STORAGE_KEY);
} catch {
  // storage blocked: the first platform is used
}
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export type PlatformSelection = {
  options: { id: string; label: string }[];
  providerId: string | null;
  rule: CycleRule;
  setPlatform: (id: string) => void;
};

// `available` is the platforms present in the loaded sessions, so it must be derived before the
// platform filter is applied — otherwise the selector would only ever offer the current choice.
export function usePlatformSelection(available: readonly string[]): PlatformSelection {
  const current = useSyncExternalStore(subscribe, () => selected, () => null);
  // A remembered platform that is no longer live falls back to the first one offered.
  const providerId = current && available.includes(current) ? current : available[0] ?? null;

  const setPlatform = useCallback((id: string) => {
    selected = id;
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    for (const listener of listeners) listener();
  }, []);

  return {
    options: available.map((id) => ({ id, label: providerLabel(id) })),
    providerId,
    rule: cycleRuleFor(providerId),
    setPlatform,
  };
}

// Shown only when there is more than one platform to choose from.
export function PlatformSelect({ options, providerId, onChange }: { options: { id: string; label: string }[]; providerId: string | null; onChange: (id: string) => void }) {
  if (options.length < 2) return null;
  return (
    <select
      value={providerId ?? ""}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Charging platform"
      className="rounded-lg border border-line bg-raised px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-2 focus:ring-focus-ring/25"
    >
      {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  );
}
