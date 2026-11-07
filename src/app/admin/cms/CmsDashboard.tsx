"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { requestCmsWindow } from "./cmsWindowStore";
import { shortChargerLabel, splitActiveSessions } from "./transactionFilters";
import { previousBillingCycle } from "@/lib/billingCycle";
import { ConsumptionCard } from "./cmsConsumptionCard";
import type { Transaction } from "./cmsCache";
import { mergeTransactionData } from "./cmsCache";
import { useLiveMetrics, withLiveValues } from "./useLiveMetrics";
import { StationSelect, useStationSelection } from "./stationSelection";
import { PlatformSelect, usePlatformSelection } from "./platformSelection";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { collectionLength } from "./cmsHelpers";
import { PeriodMatrixCard, type MatrixPeriod } from "./cmsMatrixCard";
import { StatusCard, type ConnectorState } from "./cmsStatusCard";
import { SessionsCard } from "./cmsSessionsCard";
import { useCmsData } from "./useCmsData";
import { useSessionsTable } from "./useSessionsTable";


export default function CmsOperatorDashboard() {
  const { isPartner } = useAdminModule(); // backfill is full access only (investors are read-only)
  // Status is capped to the matrix/Consumption pair's height on a wide screen, so a long
  // session detail scrolls inside the card rather than stretching the row.
  const pairRef = useRef<HTMLDivElement>(null);
  const [pairHeight, setPairHeight] = useState<number | null>(null);
  useEffect(() => {
    const pair = pairRef.current;
    if (!pair || typeof ResizeObserver === "undefined") return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const apply = () => setPairHeight(wide.matches ? pair.offsetHeight : null);
    const watch = new ResizeObserver(apply);
    watch.observe(pair);
    wide.addEventListener("change", apply);
    apply();
    return () => {
      watch.disconnect();
      wide.removeEventListener("change", apply);
    };
  }, []);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState("");




  // The CMS window is loaded through cmsWindowStore, shared with Overview: a Refresh
  // started on either page is one request, and both pages follow it.
  // The cards belong to the platforms the selector shows, each on its own billing cycle; see
  // ./platformSelection.
  const { options: stationOptions, stationId, setStation, filterCache } = useStationSelection();
  // Derived from the unfiltered cache, so choosing a platform never narrows what is on offer.
  const [livePlatforms, setLivePlatforms] = useState<string[]>([]);
  // This page can draw platforms side by side, so it offers "All platforms".
  const { options: platformOptions, selection, shown: shownPlatforms, setPlatform } = usePlatformSelection(livePlatforms, { allowAll: true });
  const { baseDashboard, platformMetrics, allTransactions, activeTransactions, active, activeTransactionIds, cpoMobileNumbers, loading, message, setMessage, dataTill, warnings } = useCmsData({ filterCache, shownPlatforms, setLivePlatforms });

  const load = useCallback((forceRefresh = false) => requestCmsWindow(forceRefresh), []);

  const startHistoricalBackfill = useCallback(async () => {
    if (backfillRunning) return;
    // One fixed window, the previous billing cycle, for both stages and every batch of this run.
    const { from, to } = previousBillingCycle();
    const day = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
    const cycle = `${day.format(new Date(from))} – ${day.format(new Date(Date.parse(to) - 1))}`;
    const confirmed = window.confirm(
      `Start history backfill for the previous billing cycle (${cycle})? This saves every ChargeMOD session in it, then fetches their meter readings in batches. It may take several minutes.`
    );
    if (!confirmed) return;

    setBackfillRunning(true);
    setBackfillStatus(`Fetching sessions for ${cycle}…`);
    const post = async (body: Record<string, unknown>) => {
      const response = await fetch("/api/cms/live/backfill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ from, to, ...body }),
      });
      return { response, result: await response.json().catch(() => ({})) };
    };
    let totalSucceeded = 0;
    let totalFailed = 0;
    const failedIds = new Set<string>();
    let sourceWarning = "";
    try {
      const sync = await post({ stage: "transactions" });
      const synced = sync.result as {
        retrieved?: Record<string, number>; // sessions per platform
        sessions?: number;
        synced?: number;
        sourceErrors?: string[];
        error?: string;
      };
      if (!sync.response.ok) {
        throw new Error(`${synced.error || `Session sync failed (HTTP ${sync.response.status})`}. Meter readings were not fetched.`);
      }
      if (synced.sourceErrors?.length) {
        console.warn("Backfill source errors:", synced.sourceErrors);
        sourceWarning = ` · some sources failed (${synced.sourceErrors.join("; ")}), so their sessions may be missing; run it again later`;
      }
      const perPlatform = Object.entries(synced.retrieved ?? {}).map(([label, n]) => `${label} ${n}`).join(", ");
      const sessionsLine = `${(synced.synced ?? 0).toLocaleString()} sessions saved${perPlatform ? ` (${perPlatform})` : ""}`;
      setBackfillStatus(`${sessionsLine}${sourceWarning} · fetching meter readings…`);

      for (let batch = 1; batch <= 30; batch += 1) {
        const { response, result: raw } = await post({ stage: "meters", limit: 10, exclude: [...failedIds] });
        const result = raw as {
          requested?: number;
          succeeded?: number;
          failed?: number;
          failures?: Array<{ transactionId: string; error: string }>;
          remaining?: number | null;
          complete?: boolean;
          rateLimited?: boolean;
          error?: string;
        };
        if (!response.ok) {
          console.error(`Batch ${batch} failed with HTTP ${response.status}.`, result);
          throw new Error(`${sessionsLine}, but meter readings stopped: ${result.error || `HTTP ${response.status}`}`);
        }

        totalSucceeded += result.succeeded ?? 0;
        totalFailed += result.failed ?? 0;
        for (const failure of result.failures ?? []) failedIds.add(failure.transactionId);
        if (result.failures?.length) {
          console.warn(`Batch ${batch} meter-reading failures:`);
          console.table(result.failures);
        }
        const meters = `meter readings: ${totalSucceeded.toLocaleString()} saved · ${totalFailed} failed · ${(result.remaining ?? "unknown").toLocaleString()} remaining`;
        setBackfillStatus(`${sessionsLine}${sourceWarning} · ${meters}`);

        if (result.rateLimited) {
          setBackfillStatus(`Paused by ChargeMOD rate limit · ${sessionsLine}${sourceWarning} · ${meters}. Wait a few minutes, then click again to continue.`);
          return;
        }
        // remaining counts failed sessions too, so complete means every one was saved.
        if (result.complete) {
          setBackfillStatus(sourceWarning
            ? `Meter readings done, but not complete · ${sessionsLine}${sourceWarning} · ${meters}`
            : `Backfill complete · ${sessionsLine} · ${meters}`);
          return;
        }
        // Nothing left to try in this run except sessions that already failed.
        if (!result.requested) {
          setBackfillStatus(`Not complete · ${sessionsLine}${sourceWarning} · ${meters}. Click again to retry the failed sessions.`);
          return;
        }
      }
      setBackfillStatus(`Paused after 300 sessions · ${sessionsLine}${sourceWarning} · meter readings: ${totalSucceeded} saved · ${totalFailed} failed. Click again to continue.`);
    } catch (error) {
      console.error("Historical backfill stopped due to an error.", error);
      setBackfillStatus(error instanceof Error ? `Backfill stopped: ${error.message}` : "Backfill stopped due to an unknown error.");
    } finally {
      setBackfillRunning(false);
    }
  }, [backfillRunning]);

  // The table and the Status card follow the platform selector, so neither keeps a platform
  // filter of its own. An empty selection is the first load, before the platforms are known.
  const onShownPlatform = useCallback(
    (transaction: Transaction) => shownPlatforms.length === 0 || shownPlatforms.includes(transaction.provider ?? ""),
    [shownPlatforms]
  );
  // Live sessions for the Active now card; a stored copy can carry better energy figures.
  const activeSessions = useMemo(() => {
    const stored = new Map(allTransactions.map((t) => [t.transactionId || t.id, t]));
    return activeTransactions
      .filter(onShownPlatform)
      .map((t) => {
        const known = stored.get(t.transactionId || t.id);
        return known ? mergeTransactionData(known, t) : t;
      });
  }, [allTransactions, activeTransactions, onShownPlatform]);
  // Stuck sessions (past 7 hours, or an older duplicate on the same gun) are not counted as charging.
  const { live: liveSessions } = useMemo(() => splitActiveSessions(activeSessions), [activeSessions]);
  // Live meter readings for every charging session; the Status list shows their Energy.
  const liveById = useLiveMetrics(liveSessions.map((s) => s.transactionId || s.id));
  const liveShown = useMemo(() => liveSessions.map((s) => withLiveValues(s, liveById[s.transactionId || s.id])), [liveSessions, liveById]);
  // Every gun that ran a session in the last 30 days on the shown platforms, with the ones a
  // live session is on marked. The CMS reports nothing about an idle gun, so this is the only
  // honest way to list them — and "Idle" can only mean no session is running, never that the
  // gun is healthy.
  const connectors = useMemo(() => {
    const gunKey = (t: Transaction) => `${t.provider ?? ""}|${t.chargerName ?? ""}|${t.connectorId ?? ""}`;
    const guns = new Map<string, { gun: ConnectorState; at: number }>();
    let newest = 0;
    for (const transaction of allTransactions) {
      if (!onShownPlatform(transaction)) continue;
      const at = transaction.startedAt ? new Date(transaction.startedAt).getTime() : NaN;
      if (!Number.isFinite(at)) continue;
      if (at > newest) newest = at;
      const key = gunKey(transaction);
      const known = guns.get(key);
      // The newest session names the gun, so a renamed charger shows its current name.
      if (known && known.at >= at) continue;
      guns.set(key, {
        at,
        gun: {
          id: key,
          label: shortChargerLabel(transaction.chargerName, transaction.stationType, transaction.connectorId),
          location: transaction.location ?? null,
          provider: transaction.provider,
          charging: false,
        },
      });
    }
    // Thirty days back from the newest session in the window rather than from the clock, so
    // the list is the same on every render and a gun that stopped being used drops off.
    const since = newest - 30 * 24 * 60 * 60 * 1000;
    const busy = new Set(liveShown.map(gunKey));
    return Array.from(guns.values())
      .filter((entry) => entry.at >= since)
      .sort((a, b) => a.gun.label.localeCompare(b.gun.label))
      .map((entry) => ({ ...entry.gun, charging: busy.has(entry.gun.id) }));
  }, [allTransactions, onShownPlatform, liveShown]);
  const table = useSessionsTable({ allTransactions, activeTransactions, activeTransactionIds, cpoMobileNumbers, onShownPlatform, setMessage, liveById });
  const { locationOptions } = table;
  const waiting = loading && allTransactions.length === 0;
  // From the location list, not the filtered rows, so a quiet day doesn't show 0.
  const activeCount = activeSessions.length ? liveSessions.length : active;
  const locationCount = Math.max(collectionLength(baseDashboard?.locations), locationOptions.length);

  const manyPlatforms = shownPlatforms.length > 1;
  // The matrix columns: Today, then the current cycle and the one before, each carrying one
  // split per platform shown.
  const cycleColumn = (index: number): MatrixPeriod => {
    const short = index === 0 ? "Current cycle" : "Previous cycle";
    const dates = (platformMetrics ?? []).map((metrics) => metrics.cycles[index]?.dates ?? "");
    return {
      // With one platform the dates belong in the heading's tooltip; with more they are listed
      // under it, since each platform closes its cycle on its own day.
      title: dates.length === 1 ? `${short} (${dates[0]})` : short,
      short,
      dates,
      splits: platformMetrics ? platformMetrics.map((metrics) => metrics.cycles[index]?.split ?? null) : [null],
    };
  };
  const matrixPeriods: MatrixPeriod[] = [
    { title: "Today", short: "Today", dates: [], splits: platformMetrics ? platformMetrics.map((metrics) => metrics.today) : [null] },
    cycleColumn(0),
    cycleColumn(1),
  ];

  return (
    <>
      <main className="cms-dashboard min-h-screen bg-page px-4 pb-12 pt-6 text-ink sm:px-6 sm:pb-16 lg:px-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <section className="relative z-10 mb-6 overflow-visible rounded-xl border border-line/80 bg-surface p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              CMS Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Operational overview of charging sessions, chargers, locations, energy and revenue from the connected CMS.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PlatformSelect options={platformOptions} selection={selection} onChange={setPlatform} />
            <StationSelect options={stationOptions} stationId={stationId} onChange={setStation} />
            {dataTill && (
              <p className="text-xs text-muted">
                Data till{" "}
                {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(dataTill))}
              </p>
            )}
            {isPartner && <button
              type="button"
              onClick={() => void startHistoricalBackfill()}
              disabled={backfillRunning}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Activity size={16} className={backfillRunning ? "motion-safe:animate-pulse" : ""} />
              {backfillRunning ? "Backfill running…" : "Start history backfill"}
            </button>}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-3.5 py-2 text-sm font-semibold text-ink hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "motion-safe:animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div></section>

        {backfillStatus && (
          <div role="status" aria-live="polite" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {backfillStatus}
          </div>
        )}

        {warnings.length > 0 && (
          <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Part of the last sync failed.</span> {warnings.join("; ")}
          </div>
        )}

        {message && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-sm text-red-700"><span className="font-semibold">Couldn&apos;t load CMS data.</span> {message}</p>
            <button
              onClick={() => void load(true)}
              className="rounded-lg border border-red-200 bg-surface px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {/* The matrix and Consumption are one pair that stretch to each other's height;
            Status sits beside them, capped to that height so opening a session scrolls
            inside the card instead of growing the page. */}
        <div className="relative z-0 mb-6 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,42.5rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,49rem)_minmax(0,1fr)]">
          <div ref={pairRef} className="grid min-w-0 items-stretch gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,13.5rem)] xl:grid-cols-[minmax(0,33rem)_minmax(0,15rem)]">
            <PeriodMatrixCard platforms={shownPlatforms} periods={matrixPeriods} />
            <ConsumptionCard platformMetrics={platformMetrics} manyPlatforms={manyPlatforms} />
          </div>
          <div className="min-w-0 overflow-y-auto" style={pairHeight ? { maxHeight: pairHeight } : undefined}>
            <StatusCard connectors={connectors} count={activeCount} sessions={liveShown} liveById={liveById} showLocation={locationCount > 1} showProvider={manyPlatforms} />
          </div>
        </div>

        <SessionsCard

          {...table}
          activeTransactionIds={activeTransactionIds}
          loading={loading}
          manyPlatforms={manyPlatforms}
          message={message}
          waiting={waiting}

        />
      </div>
    </main>
    </>
  );
}


// Site names from ChargeMOD, shortened like the table's Location column; green when a car is charging there.
