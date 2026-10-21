"use client";

import { useEffect, useState } from "react";
import type { LiveMetrics } from "@/lib/cms/liveMetrics";
import type { CmsTransaction } from "@/lib/cms/types";

const REFRESH_MS = 30_000;
// A bound on ChargeMOD calls per refresh; the site has far fewer guns than this.
const MAX_SESSIONS = 12;

export type LiveState = { metrics: LiveMetrics | null; error: string };

async function fetchMetrics(id: string): Promise<LiveState> {
  try {
    const response = await fetch(`/api/cms/live/${encodeURIComponent(id)}`, { cache: "no-store" });
    const rawBody = await response.text();
    let data: (LiveMetrics & { error?: string }) | null = null;
    try {
      data = JSON.parse(rawBody) as LiveMetrics & { error?: string };
    } catch {
      // Non-JSON response is surfaced as an error below.
    }
    if (!response.ok) throw new Error((data?.error ?? rawBody) || `HTTP ${response.status}`);
    if (!data) throw new Error(`Live transaction API returned non-JSON data (HTTP ${response.status}).`);
    return { metrics: data, error: "" };
  } catch (e) {
    return { metrics: null, error: e instanceof Error ? e.message : "Live readings are unavailable." };
  }
}

// Meter readings for the sessions charging now, refreshed every 30 s while the tab is visible.
// The live route also saves them on the session's row, so the database follows the screen.
export function useLiveMetrics(sessionIds: string[]) {
  const [byId, setById] = useState<Record<string, LiveState>>({});
  const key = sessionIds.slice(0, MAX_SESSIONS).join("|");

  useEffect(() => {
    const ids = key ? key.split("|") : [];
    if (!ids.length) return;
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const results = await Promise.all(ids.map(async (id) => [id, await fetchMetrics(id)] as const));
      if (cancelled) return;
      setById((current) => {
        const next = { ...current };
        // Keep the last good readings when a refresh fails.
        for (const [id, state] of results) next[id] = state.metrics ? state : { metrics: current[id]?.metrics ?? null, error: state.error };
        return next;
      });
    };
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [key]);

  return byId;
}

// A charging session with its live meter values in place of ChargeMOD's (often 0) figures.
export function withLiveValues<T extends CmsTransaction>(session: T, live: LiveState | undefined): T {
  const m = live?.metrics;
  if (!m) return session;
  return {
    ...session,
    energyKwh: m.kwhDelivered != null && m.kwhDelivered > 0 ? m.kwhDelivered : session.energyKwh,
    startSoc: session.startSoc ?? m.startSoc,
    endSoc: m.currentSoc ?? session.endSoc,
  };
}
