import { loadCmsWindow, type CmsCache } from "./CmsDashboard";

// One CMS window load for the whole admin tab. Overview and the CMS dashboard both
// subscribe here, so a Refresh started on one page is the same request the other page
// shows (its spinner included) instead of a second, separate fetch.
export type CmsWindowSnapshot = {
  cache: CmsCache | null;
  // True while a load runs; `cache` may then be a stored copy shown ahead of the live one.
  refreshing: boolean;
  error: string | null;
};

let snapshot: CmsWindowSnapshot = { cache: null, refreshing: false, error: null };
let inFlight: { promise: Promise<void>; force: boolean } | null = null;
const listeners = new Set<(snapshot: CmsWindowSnapshot) => void>();

function set(next: Partial<CmsWindowSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener(snapshot);
}

export function getCmsWindowSnapshot() {
  return snapshot;
}

export function subscribeCmsWindow(listener: (snapshot: CmsWindowSnapshot) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// force = the Refresh button. A plain load joins any running one; a Refresh joins a
// running Refresh but starts fresh after a plain load.
export function requestCmsWindow(force = false): Promise<void> {
  if (inFlight && (inFlight.force || !force)) return inFlight.promise;

  set({ refreshing: true, error: null });
  // A token, not the promise: the stored copy can arrive before the promise exists.
  const run = { promise: Promise.resolve(), force };
  inFlight = run;
  const current = () => inFlight === run;
  run.promise = loadCmsWindow(force, (stored) => {
    if (current()) set({ cache: stored });
  })
    .then((cache) => {
      if (current()) set({ cache, refreshing: false, error: null });
    })
    .catch((error: unknown) => {
      if (current()) set({ refreshing: false, error: error instanceof Error ? error.message : "CMS request failed." });
    })
    .finally(() => {
      if (current()) inFlight = null;
    });
  return run.promise;
}
