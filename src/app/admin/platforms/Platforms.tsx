"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plug, RefreshCw } from "lucide-react";
import { useAdminModule } from "@/components/admin/AdminModuleContext";
import { confirmDialog } from "@/components/admin/confirmDialog";
import type { CycleRule } from "@/lib/billingCycle";

// Switching charging platforms on and off. Full access only (partner or IT admin): a platform
// going off stops the sync for every admin, and freezing ChargeMOD is how the Ionage cutover
// happens. Credentials are not here — they stay on the deployment, and this page only reports
// which required variables are missing.

type Platform = {
  id: string; label: string; enabled: boolean; configured: boolean;
  missingEnv: string[]; cycle: CycleRule; updatedAt: string | null; updatedBy: string | null;
};

const describeCycle = (cycle: CycleRule) =>
  cycle.kind === "half-month" ? "Half-months (1–15, 16–end)" : `Every ${cycle.length} days from ${cycle.anchor}`;

const changedOn = (at: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }).format(new Date(at));

async function readPlatforms(): Promise<{ platforms: Platform[]; error: string }> {
  try {
    const response = await fetch("/api/admin/platforms", { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as { platforms?: Platform[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? (response.status === 403 ? "Full access is required." : "Could not load platforms."));
    return { platforms: data.platforms ?? [], error: "" };
  } catch (err) {
    return { platforms: [], error: err instanceof Error ? err.message : "Could not load platforms." };
  }
}

export default function Platforms() {
  const { setActiveModule } = useAdminModule();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const show = useCallback(({ platforms, error }: Awaited<ReturnType<typeof readPlatforms>>) => {
    if (error) setError(error); else setPlatforms(platforms);
    setLoading(false);
  }, []);
  const loadPlatforms = useCallback(async () => {
    setLoading(true); setError("");
    show(await readPlatforms());
  }, [show]);
  // On mount loading is already true and error empty, so the first read only shows its result.
  useEffect(() => {
    let current = true;
    void readPlatforms().then((result) => { if (current) show(result); });
    return () => { current = false; };
  }, [show]);

  async function toggle(platform: Platform) {
    setError(""); setNotice("");
    const turningOff = platform.enabled;
    const ok = await confirmDialog({
      title: turningOff ? `Switch ${platform.label} off?` : `Switch ${platform.label} on?`,
      message: turningOff
        ? `New sessions will stop being fetched from ${platform.label} for everyone. Sessions already stored stay on the dashboard and in billing — nothing is deleted.`
        : `${platform.label} sessions will start syncing for every admin on the next refresh.`,
      confirmLabel: turningOff ? "Switch off" : "Switch on",
      danger: turningOff,
    });
    if (!ok) return;
    setSaving(platform.id);
    try {
      const response = await fetch("/api/admin/platforms", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: platform.id, enabled: !platform.enabled }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not change the platform.");
      setNotice(`${platform.label} is now ${turningOff ? "off" : "on"}. Refresh the dashboard to see the change.`);
      await loadPlatforms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the platform.");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <button type="button" onClick={() => setActiveModule("cms")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-accent"><ArrowLeft size={16}/> Back to CMS Dashboard</button>
      <section className="rounded-2xl border border-line/80 bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><div className="rounded-xl bg-accent-pale p-3 text-accent"><Plug size={23}/></div><div>
            <h1 className="text-2xl font-bold tracking-tight">Platforms</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">The charging platforms the admin reads sessions from. Switching one off stops new sessions being fetched; everything already stored stays. Credentials are set on the deployment, not here.</p>
          </div></div>
          <button type="button" onClick={() => void loadPlatforms()} disabled={loading || !!saving} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-raised disabled:opacity-50"><RefreshCw size={15} className={loading ? "motion-safe:animate-spin" : ""}/> Refresh</button>
        </div>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

        <ul className="mt-7 space-y-3">
          {platforms.map((platform) => {
            // Enabled without credentials cannot sync, so it is called out rather than shown as on.
            const live = platform.enabled && platform.configured;
            return (
              <li key={platform.id} className="rounded-xl border border-line bg-raised p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <p className="text-base font-bold tracking-tight text-ink">{platform.label}</p>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${live ? "bg-emerald-100 text-emerald-800" : "bg-soft text-muted"}`}>
                        {live ? "ON" : "OFF"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-muted">Bills in: {describeCycle(platform.cycle)}</p>
                    {!platform.configured && (
                      <p className="mt-1.5 text-xs leading-5 text-amber-700">
                        No credentials on this deployment. Set {platform.missingEnv.join(", ")} before switching it on.
                      </p>
                    )}
                    {platform.updatedAt && (
                      <p className="mt-1.5 text-xs leading-5 text-muted">
                        Last changed {changedOn(platform.updatedAt)}{platform.updatedBy ? ` by ${platform.updatedBy}` : ""}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggle(platform)}
                    disabled={!!saving || (!platform.enabled && !platform.configured)}
                    className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-soft disabled:opacity-50"
                  >
                    {saving === platform.id ? "Saving…" : platform.enabled ? "Switch off" : "Switch on"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {!loading && !error && platforms.length === 0 && <p className="mt-7 text-sm text-muted">No charging platforms are built in yet.</p>}
      </section>
    </div>
  );
}
