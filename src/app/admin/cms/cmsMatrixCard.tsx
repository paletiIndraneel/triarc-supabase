import type { PeriodSplit } from "./cmsHelpers";
import GlassCard from "@/components/ui/GlassCard";
import { providerLabel } from "@/lib/cms/providerIds";
import { matrixKwh, money } from "./cmsHelpers";

export type MatrixPeriod = {
  // The full column name, kept in the heading's tooltip; `short` is what is drawn.
  title: string;
  short: string;
  // The column's cycle dates, one per platform shown, listed under the heading when more than
  // one platform is shown, because each closes its cycle on its own day.
  dates: string[];
  // One split per platform shown, in the order of the card's `platforms`.
  splits: Array<PeriodSplit | null>;
};


// The three billing periods in one card. Every cell leads with kWh and carries the revenue
// underneath, so four columns do the work the three separate cards needed seven for, and the
// periods are told apart by space rather than by ruling every column. With more than one
// platform shown each row is drawn once per platform: their figures are never added, since
// their cycles close on different days.
export function PeriodMatrixCard({ platforms, periods }: { platforms: readonly string[]; periods: MatrixPeriod[] }) {
  const rows: Array<{ label: string; energy: (split: PeriodSplit) => number; revenue: ((split: PeriodSplit) => number) | null }> = [
    { label: "AC Charger", energy: (split) => split.energy.ac, revenue: (split) => split.revenue.ac },
    { label: "DC Charger", energy: (split) => split.energy.dc, revenue: (split) => split.revenue.dc },
    { label: "CPO", energy: (split) => split.energy.cpo, revenue: null },
  ];
  // An empty selection is the first load, before the platforms are known: one unnamed group.
  const groups = platforms.length ? platforms : [""];
  const many = groups.length > 1;
  const platformName = (provider: string) => (
    <span className="mt-0.5 block text-[9.5px] font-medium uppercase tracking-[0.06em] text-muted">{providerLabel(provider)}</span>
  );
  return (
    <GlassCard className="flex min-w-0 flex-col rounded-xl border border-line/80 bg-surface p-4 shadow-sm">
      <div className="flex-1 overflow-x-auto">
        <table className="h-full w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[22%]" />
            {periods.map((period) => <col key={period.title} className="w-[26%]" />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Charger</th>
              {periods.map((period) => (
                <th
                  key={period.title}
                  scope="col"
                  title={period.title}
                  className="whitespace-nowrap pb-2 pl-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted"
                >
                  {period.short}
                  {many && period.dates.map((dates, index) => (
                    <span key={groups[index]} className="mt-0.5 block text-[9px] font-medium normal-case tracking-normal text-muted">
                      {providerLabel(groups[index])} {dates}
                    </span>
                  ))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => groups.map((provider, group) => (
              <tr key={`${row.label} ${provider}`}>
                <th scope="row" className={`truncate border-t border-line/40 py-1.5 text-left text-xs font-medium ${row.revenue ? "text-ink" : "text-accent"}`}>
                  {/* The row is named once for the group; every line says which platform it is. */}
                  {group === 0 ? row.label : ""}
                  {many && platformName(provider)}
                </th>
                {periods.map((period) => {
                  const split = period.splits[group] ?? null;
                  return (
                    <td key={period.title} className="border-t border-line/40 py-1.5 pl-3 text-right align-baseline leading-tight">
                      <span className="block text-[13px] font-semibold tabular-nums tracking-[-0.015em] text-ink whitespace-nowrap">{split ? <>{matrixKwh(row.energy(split))}<i className="ml-[3px] text-[9px] font-semibold not-italic tracking-[0.04em] text-muted">kWh</i></> : "—"}</span>
                      <span className="block text-[11px] tabular-nums text-muted">{split && row.revenue ? money(row.revenue(split)) : " "}</span>
                    </td>
                  );
                })}
              </tr>
            )))}
            {groups.map((provider, group) => (
              <tr key={`Total ${provider}`}>
                <th scope="row" className="truncate border-t border-line pt-2 text-left text-xs font-bold text-ink">
                  Total
                  {many && platformName(provider)}
                </th>
                {periods.map((period) => {
                  const split = period.splits[group] ?? null;
                  return (
                    <td key={period.title} className="border-t border-line pt-2 pl-3 text-right align-baseline leading-tight">
                      <span className="block text-[15px] font-bold tabular-nums tracking-[-0.015em] text-ink whitespace-nowrap">{split ? <>{matrixKwh(split.energy.total)}<i className="ml-[3px] text-[9px] font-semibold not-italic tracking-[0.04em] text-muted">kWh</i></> : "—"}</span>
                      <span className="block text-[11px] tabular-nums text-muted">{split ? money(split.revenue.total) : " "}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2.5 text-[10px] uppercase tracking-[0.09em] text-muted">
        kWh above · revenue below · CPO is AC + DC{many ? " · per platform, never added" : ""}
      </p>
    </GlassCard>
  );
}
