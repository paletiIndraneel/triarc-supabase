import Container from "@/components/Container";
import ChargerCard from "./ChargerCard";
import { chargingSolutions } from "@/data/charging";

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