"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { providerLabel } from "@/lib/cms/providerIds";
import { cycleRuleFor, type CycleRule } from "@/lib/billingCycle";

// The charging platform the cards belong to, shared by the CMS dashboard and Overview, kept in
// this browser like the station choice.
//
// A platform's figures are never added to another's: every platform bills on its own cycle
// (ChargeMOD in half-months, Ionage every 7 days), so a total summed across two of them would
// match no bill and no reality. "All platforms" therefore means side by side — one set of rows
// per platform — and only a page that can show them that way asks for it (`allowAll`). A page
// that cannot (Overview, one figure to a card) reads the remembered "all" as the first platform.
// With one platform live the choice is implied and the selector is hidden.

const STORAGE_KEY = "triarc-admin-platform";
export const ALL_PLATFORMS = "all";

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
  // What the selector shows: a platform id, or ALL_PLATFORMS.
  selection: string | null;
  // The platforms the cards cover: one, or every live one in "all". Stable between renders.
  shown: readonly string[];
  // The single chosen platform, null in "all": a page that sums into one figure uses this.
  providerId: string | null;
  rule: CycleRule;
  setPlatform: (id: string) => void;
};

// `available` is the platforms present in the loaded sessions, so it must be derived before the
// platform filter is applied — otherwise the selector would only ever offer the current choice.
export function usePlatformSelection(available: readonly string[], { allowAll = false } = {}): PlatformSelection {
  const current = useSyncExternalStore(subscribe, () => selected, () => null);
  const all = allowAll && available.length > 1;
  // A remembered platform that is no longer live falls back to the first one offered, and so
  // does "all" on a page that cannot show platforms side by side.
  const selection = current === ALL_PLATFORMS
    ? (all ? ALL_PLATFORMS : available[0] ?? null)
    : current && available.includes(current) ? current : available[0] ?? null;
  const providerId = selection === ALL_PLATFORMS ? null : selection;
  // Keyed by string so the array identity only changes when the platforms do: it is an effect
  // dependency on both pages.
  const shownKey = (selection === ALL_PLATFORMS ? available : providerId ? [providerId] : []).join("|");
  const shown = useMemo(() => (shownKey ? shownKey.split("|") : []), [shownKey]);

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
    options: [
      ...(all ? [{ id: ALL_PLATFORMS, label: "All platforms" }] : []),
      ...available.map((id) => ({ id, label: providerLabel(id) })),
    ],
    selection,
    shown,
    providerId,
    rule: cycleRuleFor(providerId),
    setPlatform,
  };
}

// Shown only when there is more than one platform to choose from.
export function PlatformSelect({ options, selection, onChange }: { options: { id: string; label: string }[]; selection: string | null; onChange: (id: string) => void }) {
  if (options.length < 2) return null;
  return (
    <select
      value={selection ?? ""}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Charging platform"
      className="rounded-lg border border-line bg-raised px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-2 focus:ring-focus-ring/25"
    >
      {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  );
}
