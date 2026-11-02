import GlassCard from "@/components/ui/GlassCard";
import { providerLabel } from "@/lib/cms/providerIds";
import { matrixKwh, money, type PeriodSplit } from "./cmsHelpers";

export type PlatformMetrics = {
  provider: string;
  today: PeriodSplit;
  // The current cycle, then the one before it.
  cycles: Array<{ dates: string; split: PeriodSplit }>;
  earlier: Array<{ label: string; energy: number; revenue: number }>;
};

export function ConsumptionCard({ platformMetrics, manyPlatforms }: { platformMetrics: PlatformMetrics[] | null; manyPlatforms: boolean }) {
  return (
        <GlassCard className="flex min-w-0 flex-col rounded-xl border border-line/80 bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Consumption Details</p>
          <p className="mt-1 text-xs font-medium text-muted">Earlier cycles</p>
          <div className="mt-2.5">
            {/* With two platforms each gets a heading and its three most recent cycles, so the
                card keeps roughly the height it has with one. */}
            {(platformMetrics ?? []).map((metrics) => (
              <div key={metrics.provider}>
                {manyPlatforms && (
                  <p className="mt-2 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-muted first:mt-0">{providerLabel(metrics.provider)}</p>
                )}
                {metrics.earlier.slice(0, manyPlatforms ? 3 : 5).map((cycle) => (
                  <div key={cycle.label} className="flex items-baseline justify-between gap-2.5 border-t border-line/40 py-1.5 first:border-t-0">
                    <p className="whitespace-nowrap text-[11px] font-medium text-muted">{cycle.label}</p>
                    <p className="text-right">
                      <span className="block whitespace-nowrap text-[13px] font-semibold tabular-nums tracking-[-0.015em] text-ink">
                        {matrixKwh(cycle.energy)}
                        <i className="ml-[3px] text-[9px] font-semibold not-italic tracking-[0.04em] text-muted">kWh</i>
                      </span>
                      <span className="mt-px block whitespace-nowrap text-[10.5px] tabular-nums text-muted">{money(cycle.revenue)}</span>
                    </p>
                  </div>
                ))}
              </div>
            ))}
            {!platformMetrics && <p className="text-xs text-muted">Loading consumption</p>}
          </div>
          <p className="mt-auto pt-2.5 text-[10px] uppercase tracking-[0.09em] text-muted">kWh above · revenue below</p>
        </GlassCard>
  );
}
