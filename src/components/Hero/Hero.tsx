import Container from "../Container";
import HeroImage from "./HeroImage";

export default function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_34%),linear-gradient(135deg,_#03110d_0%,_#06231b_48%,_#04140f_100%)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle,_rgba(16,185,129,0.14),_transparent_70%)]" />

      <Container className="relative px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="mx-auto grid w-full max-w-[1380px] items-center gap-10 pb-14 pt-28 sm:pb-16 sm:pt-32 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:pb-20 lg:pt-36">
          {/* Hero content */}
          <div className="motion-reveal max-w-2xl text-center lg:text-left">
            <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
              TRIARC EV Hub · Bhadrachalam
            </span>

            <h1
              id="hero-heading"
              className="mt-6 text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl xl:text-[4.4rem]"
            >
              EV Charging Station
              <span className="block text-emerald-300">
                in Bhadrachalam
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg lg:mx-0">
              Hub Model, Multiple DC Fast Chargers, Open 24x7, Accomodation
            </p>
          </div>

          {/* Hero image */}
          <div className="motion-delay-1">
            <HeroImage />
          </div>
        </div>
      </Container>
    </section>
  );
}