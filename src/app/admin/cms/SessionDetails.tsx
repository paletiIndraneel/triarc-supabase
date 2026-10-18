"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CmsTransaction } from "@/lib/cms/types";
import type { LiveMetrics } from "@/lib/cms/liveMetrics";
import { shortChargerLabel } from "./transactionFilters";

const REFRESH_MS = 30_000;
const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
const num = (n: number, digits = 1) => n.toLocaleString("en-IN", { maximumFractionDigits: digits });

function duration(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

// Details of one live session, opened from the Status card. Metrics come from the session's
// meter values via /api/cms/live and refresh while the panel is open and the tab is visible.
export default function SessionDetails({ session, onClose }: { session: CmsTransaction; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [error, setError] = useState("");
  const id = session.transactionId || session.id;

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/cms/live/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = (await response.json()) as LiveMetrics & { error?: string };
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error ?? "Live readings are unavailable.");
        setMetrics(data);
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Live readings are unavailable.");
      }
    };
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id]);

  const startSoc = metrics?.startSoc ?? session.startSoc ?? null;
  const currentSoc = metrics?.currentSoc ?? null;
  const energy = metrics?.kwhDelivered ?? session.energyKwh ?? null;
  const started = session.startedAt ? new Date(session.startedAt) : null;
  const sinceMinutes = started ? (Date.now() - started.getTime()) / 60000 : null;
  const estimating = <span className="font-normal text-slate-400">estimating…</span>;
  const dash = <span className="text-slate-400">—</span>;

  // AC sockets (e.g. 3.3 kW) don't report the vehicle's SoC, so the SoC bar and the battery,
  // to-full and time-left rows are left out once the readings show there is no SoC.
  const hasSoc = startSoc != null || currentSoc != null || metrics == null;
  const rows: Array<[string, React.ReactNode]> = [
    ["Energy", energy == null ? dash : `${num(energy, 2)} kWh`],
    ["Power now", metrics?.kwNow == null ? dash : `${num(metrics.kwNow)} kW`],
    ["Peak power", metrics?.peakKw == null ? dash : `${num(metrics.peakKw)} kW`],
  ];
  if (hasSoc) rows.push(
    ["Battery", metrics == null ? dash : metrics.batteryKwh == null ? estimating : `≈ ${num(metrics.batteryKwh, 0)} kWh`],
    [
      "To full",
      metrics == null
        ? dash
        : metrics.kwhToFull == null
          ? estimating
          : `${num(metrics.kwhToFull)} kWh${metrics.minutesLeft != null ? ` · ≈ ${duration(metrics.minutesLeft)}` : ""}`,
    ],
  );

  return (
    <dialog
      ref={ref}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
      aria-labelledby="session-details-title"
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-[0_24px_70px_rgba(16,24,40,0.18)] backdrop:bg-slate-900/40"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 id="session-details-title" className="truncate text-base font-bold">
            {shortChargerLabel(session.chargerName, session.stationType, session.connectorId)}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {started ? `Charging since ${time.format(started)}` : "Charging"}
            {sinceMinutes != null && ` · ${duration(sinceMinutes)}`}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-3 px-5 py-4 text-sm">
        {hasSoc ? (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-slate-500">SoC</span>
            <span className="font-semibold">
              {startSoc == null ? "—" : `${startSoc}%`} → {currentSoc == null ? "—" : `${currentSoc}%`}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" role="img"
            aria-label={currentSoc == null ? "Current SoC not available yet" : `Battery at ${currentSoc}%`}>
            <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${currentSoc ?? startSoc ?? 0}%` }} />
          </div>
        </div>
        ) : (
          <p className="text-xs text-slate-500">This charger doesn&apos;t report the vehicle&apos;s battery level.</p>
        )}
        <dl className="space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="text-xs font-medium text-slate-500">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {error && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Live readings: {error}</p>}
      </div>

      <dl className="space-y-1.5 border-t border-slate-100 px-5 py-4 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Customer</dt><dd className="truncate font-medium">{session.userName || "—"}</dd></div>
        {(session.vehicleNumber || session.vehicleName) && (
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Vehicle</dt><dd className="truncate font-medium">{session.vehicleNumber || session.vehicleName}</dd></div>
        )}
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Session ID</dt><dd className="truncate font-mono">{id}</dd></div>
        <p className="pt-1 text-slate-400">
          {metrics?.lastReadingAt ? `Updated ${time.format(new Date(metrics.lastReadingAt))} · ` : ""}refreshes every 30 s
        </p>
      </dl>
    </dialog>
  );
}
