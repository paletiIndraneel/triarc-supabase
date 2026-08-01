"use client";

import Container from "@/components/Container";
import ChargerCard from "./ChargerCard";
import { chargingSolutions } from "@/data/charging";

export default function ChargingSolutions() {
  const dc = chargingSolutions.find((item) => item.title.toLowerCase().includes("dc"));
  const others = chargingSolutions.filter((item) => !item.title.toLowerCase().includes("dc"));

  return (
    <section id="charging" className="relative mt-4 overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(52,211,153,0.13),_transparent_35%),#04140F] pb-16 pt-24 sm:mt-6 sm:pb-20 sm:pt-28 lg:mt-8 lg:pb-24 lg:pt-32 xl:pb-28">
      <Container>
        <div className="rounded-[30px] border border-white/10 bg-white/[0.02] p-3 sm:p-4 lg:p-5">
          <div className="grid gap-6 lg:grid-cols-[0.44fr_0.56fr] lg:items-start lg:gap-8">
            <div className="motion-reveal max-w-xl text-center sm:text-left lg:pt-4">
              <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Charging Solutions
              </span>
              <h2 className="mt-6 max-w-[12ch] text-4xl font-black leading-tight text-white sm:text-5xl lg:text-[3.1rem]">
                Charging for every journey
              </h2>
              <p className="mt-5 text-base leading-8 text-white/80 sm:text-lg lg:pl-3">
                Whether you&apos;re commuting, traveling, or managing a commercial fleet, TriArc offers dependable EV charging built around comfort, speed, and simplicity.
              </p>
            </div>

            {dc && (
              <div className="relative mt-6 lg:ml-2 lg:mt-20 xl:mt-24">
                <div className="pointer-events-none absolute -left-4 top-6 hidden h-[80%] w-px bg-gradient-to-b from-transparent via-cyan-300/35 to-transparent lg:block" />
                <ChargerCard charger={dc} featured />
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:mt-7 lg:grid-cols-2">
          {others.map((charger) => (
            <ChargerCard key={charger.title} charger={charger} />
          ))}
        </div>
      </Container>
    </section>
  );
}