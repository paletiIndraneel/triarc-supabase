import Container from "@/components/Container";
import ChargerCard from "./ChargerCard";
import { chargingSolutions } from "@/data/charging";
import { Zap, ArrowUpRight } from "lucide-react";

export default function ChargingSolutions() {
  const solutions = chargingSolutions.slice(0, 3);

  return (
    <section
      id="charging"
      className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(52,211,153,0.13),_transparent_35%),#04140F] pb-16 pt-16 sm:pb-20 sm:pt-20"
    >
      <Container>
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
            Charging Solutions
          </span>

          <h2 className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl">
            Charging for every journey
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
            Whether you&apos;re commuting, traveling, or managing a commercial
            fleet, TRIARC offers dependable EV charging built around comfort,
            speed, and simplicity.
          </p>
        </div>

       {/* Charging Expansion Announcement */}
<div className="mx-auto mt-8 max-w-4xl">
  <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-5 py-4 sm:px-6 sm:py-5">
    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />

    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <Zap size={22} />
        </div>

        <div>
          <span className="inline-flex rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#04140F]">
            Coming Soon
          </span>

          <h3 className="mt-2 text-xl font-black text-white sm:text-2xl">
            Expanding with{" "}
            <span className="text-emerald-300">
              360 kW DC Fast Charging
            </span>
          </h3>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
            TRIARC is planning a new 360 kW DC fast charger and an additional
            3.3 kW AC charger alongside our existing charging infrastructure.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <span className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">
          +360 kW DC
        </span>

        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/80">
          +3.3 kW AC
        </span>
      </div>
    </div>
  </div>
</div>

        {/* Three Charging Solution Cards */}
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {solutions.map((charger) => (
            <ChargerCard
              key={charger.title}
              charger={charger}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}