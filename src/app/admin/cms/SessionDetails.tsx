import type { CmsTransaction } from "@/lib/cms/types";
import type { StackPage, StackRow } from "@/components/ui/StackPanel";
import { shortChargerLabel } from "./transactionFilters";
import type { LiveState } from "./useLiveMetrics";

const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
const num = (n: number, digits = 4) => n.toLocaleString("en-IN", { maximumFractionDigits: digits });

function duration(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

// The Status panel's page for one live session. Metrics come from the session's meter values,
// which the dashboard polls for every charging session (useLiveMetrics).
export function sessionPage(session: CmsTransaction, live: LiveState | undefined): StackPage {
  const metrics = live?.metrics ?? null;
  const error = live?.error ?? "";

  // Start SoC comes from the transaction record; Current SoC comes only from the latest live meter reading.
  const startSoc = session.startSoc ?? metrics?.startSoc ?? null;
  const currentSoc = metrics?.currentSoc ?? null;
  const energy = metrics?.kwhDelivered ?? session.energyKwh ?? null;
  const started = session.startedAt ? new Date(session.startedAt) : null;
  const sinceMinutes = started ? (Date.now() - started.getTime()) / 60000 : null;
  const estimating = "estimating…";
  const dash = "—";

  // AC sockets (e.g. 3.3 kW) don't report the vehicle's SoC, so the SoC bar and the battery,
  // to-full and time-left rows are left out once the readings show there is no SoC.
  const hasSoc = startSoc != null || currentSoc != null || metrics == null;
  const readings: StackRow[] = [
    { id: "since", label: "Charging since", detail: started ? `${time.format(started)}${sinceMinutes != null ? ` · ${duration(sinceMinutes)}` : ""}` : dash },
  ];
  if (hasSoc) {
    readings.push({
      id: "soc",
      label: "SoC",
      detail: `${startSoc == null ? "—" : `${startSoc}%`} → ${currentSoc == null ? "—" : `${currentSoc}%`}`,
      trailing: (
        <span
          role="img"
          aria-label={currentSoc == null ? "Current SoC not available yet" : `Battery at ${currentSoc}%`}
          className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-soft"
        >
          <span className="block h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${currentSoc ?? startSoc ?? 0}%` }} />
        </span>
      ),
    });
  }
  readings.push(
    { id: "energy", label: "Energy", detail: energy == null ? dash : `${num(energy)} kWh` },
    { id: "power", label: "Power now", detail: metrics?.kwNow == null ? dash : `${num(metrics.kwNow)} kW` },
    { id: "peak", label: "Peak power", detail: metrics?.peakKw == null ? dash : `${num(metrics.peakKw)} kW` },
  );
  if (hasSoc) {
    readings.push(
      { id: "battery", label: "Battery", detail: metrics == null ? dash : metrics.batteryKwh == null ? estimating : `≈ ${num(metrics.batteryKwh, 0)} kWh` },
      {
        id: "full",
        label: "To full",
        detail:
          metrics == null
            ? dash
            : metrics.kwhToFull == null
              ? estimating
              : `${num(metrics.kwhToFull)} kWh${metrics.minutesLeft != null ? ` · ≈ ${duration(metrics.minutesLeft)}` : ""}`,
      },
    );
  }

  // Whether the car is still drawing power, and which car: the two things worth seeing at a
  // glance, so they sit in the header instead of a row. The customer's name and the session id
  // are not shown here — they are in the table.
  const charging = !session.stoppedAt;
  const plate = session.vehicleNumber || session.vehicleName || "";
  const updated = `${metrics?.lastReadingAt ? `Updated ${time.format(new Date(metrics.lastReadingAt))} · ` : ""}refreshes every 30 s`;
  const note = error ? (
    <span role="alert" className="text-amber-800">Live readings: {error}</span>
  ) : hasSoc ? null : (
    "This charger doesn't report the vehicle's battery level."
  );

  return {
    title: shortChargerLabel(session.chargerName, session.stationType, session.connectorId),
    trailing: (
      <>
        <span className={charging ? "flex items-center gap-1 text-emerald-600" : "text-muted"}>
          {charging && <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />}
          {charging ? "Charging" : "Stopped"}
        </span>
        {plate && <span className="font-mono text-ink">{plate}</span>}
      </>
    ),
    sections: [
      {
        title: "Live readings",
        rows: readings,
        footer: (
          <>
            {note && <span className="block">{note}</span>}
            <span className="block">{updated}</span>
          </>
        ),
      },
    ],
  };
}
