import { StackPanel, type StackPage } from "@/components/ui/StackPanel";
import { providerLabel } from "@/lib/cms/providerIds";
import { displayLocation, shortChargerLabel } from "./transactionFilters";
import { formatKwh } from "./cmsHelpers";
import { istDateString } from "./dateRanges";
import { sessionPage } from "./SessionDetails";
import type { LiveState } from "./useLiveMetrics";
import type { Transaction } from "./cmsCache";

// Charging state and the sessions charging now, as a Stack Panel: tap a session to drill into
// its live readings. ChargeMOD's stuck sessions (past 7 hours, or an older duplicate on a gun)
// are already filtered out by splitActiveSessions.
export type ConnectorState = { id: string; label: string; location: string | null; provider: string | undefined; charging: boolean };

export function StatusCard({ count, sessions, liveById, showLocation, showProvider, connectors }: { count: number; sessions: Transaction[]; liveById: Record<string, LiveState>; showLocation: boolean; showProvider: boolean; connectors: ConnectorState[] }) {
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  const dateTime = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const today = istDateString();
  // Time only for today's sessions; older ones get the date so 23:48 isn't read as later today.
  const started = (value: string) =>
    istDateString(new Date(value)) === today ? time.format(new Date(value)) : dateTime.format(new Date(value));
  const charging = count > 0;
  const pageId = (session: Transaction) => `session:${session.transactionId || session.id}`;

  const pages: Record<string, StackPage> = {
    status: {
      title: "Status",
      // The state and the count live in the header, so the body is only the sessions themselves.
      trailing: (
        <>
          <span className={`flex items-center gap-1.5 font-semibold ${charging ? "text-emerald-600" : "text-muted"}`}>
            <span aria-hidden="true" className={`size-1.5 rounded-full ${charging ? "bg-emerald-500 motion-safe:animate-pulse" : "bg-soft"}`} />
            {charging ? "Charging" : "Idle"}
          </span>
          <span
            aria-label={`${count} charging now`}
            className={`text-sm font-bold tabular-nums ${charging ? "text-emerald-600" : "text-ink"}`}
          >
            {count}
          </span>
        </>
      ),
      sections: [
        {
          rows: !charging
            ? [{ id: "idle", label: <span className="text-muted">No sessions charging</span> }]
            : sessions.length === 0
              ? [{ id: "loading", label: <span className="text-muted">Loading sessions…</span> }]
              : sessions.map((session) => ({
                  id: session.transactionId || session.id,
                  to: pageId(session),
                  dot: "bg-emerald-500",
                  label: (
                    <>
                      <span className="font-semibold">{shortChargerLabel(session.chargerName, session.stationType, session.connectorId)}</span>
                      {showLocation && session.location && <span className="text-muted"> · {displayLocation(session.location)}</span>}
                      {showProvider && <span className="text-muted"> · {providerLabel(session.provider)}</span>}
                    </>
                  ),
                  detail: `${session.energyKwh == null ? "—" : formatKwh(session.energyKwh)}${session.startedAt ? ` · ${started(session.startedAt)}` : ""}`,
                })),
          footer: charging && sessions.length ? "Tap a session for live SoC and time left" : undefined,
        },
        ...(connectors.length
          ? [{
              title: "Chargers",
              rows: connectors.map((gun) => ({
                id: `gun:${gun.id}`,
                dot: gun.charging ? "bg-emerald-500" : "bg-soft",
                label: (
                  <>
                    <span className={gun.charging ? "font-semibold" : "font-medium text-muted"}>{gun.label}</span>
                    {showLocation && gun.location && <span className="text-muted"> · {displayLocation(gun.location)}</span>}
                    {showProvider && <span className="text-muted"> · {providerLabel(gun.provider)}</span>}
                  </>
                ),
                detail: gun.charging ? "Charging" : "Idle",
              })),
              footer: "Guns that ran a session in the last 30 days. Idle means no session is running, not that the gun is known to be healthy.",
            }]
          : []),
      ],
    },
  };
  for (const session of sessions) pages[pageId(session)] = sessionPage(session, liveById[session.transactionId || session.id]);

  // The wrapper around this card caps its height, so a long session detail scrolls
  // there rather than stretching the row.
  return <StackPanel className="min-w-0 shadow-sm" pages={pages} root="status" />;
}
