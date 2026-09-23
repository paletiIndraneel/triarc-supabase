import { Sparkles } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { site } from "@/data/site";

export default function HeroContent() {
  return (
    <div className="motion-reveal mx-auto flex w-full max-w-[38rem] flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-[linear-gradient(120deg,rgba(16,185,129,0.24),rgba(110,231,183,0.2))] px-4 py-2 text-sm font-semibold tracking-[0.01em] text-emerald-50 shadow-[0_10px_34px_rgba(16,185,129,0.22)] backdrop-blur-md">
        <span className="rounded-full bg-emerald-300/20 p-1 text-emerald-100">
          <Sparkles size={13} />
        </span>
        <span className="bg-gradient-to-r from-emerald-50 via-lime-100 to-emerald-100 bg-clip-text text-transparent">
          TRIARC EV HUB &bull; BHADRACHALAM
        </span>
      </div>

      <h1 className="mt-8 w-full text-[clamp(2.4rem,4.8vw,5.2rem)] font-black leading-[0.95] tracking-[-0.03em] text-white [text-wrap:balance]">
        Hub Model, Multiple DC Fast Chargers, Open 24x7, Cafeteria
        <span className="mt-2 block bg-gradient-to-r from-emerald-300 via-emerald-400 to-lime-300 bg-clip-text text-transparent">
          Bhadrachalam, Telangana
        </span>
      </h1>

      <p className="mt-4 text-lg font-semibold text-emerald-200/90 sm:text-xl">Reliable EV charging for every journey.</p>

      <p className="mt-4 max-w-[38rem] text-[clamp(1rem,1.2vw,1.2rem)] leading-7 text-white/80 sm:leading-8">
        TRIARC EV Hub provides EV charging in Bhadrachalam, Telangana, while helping businesses and fleet operators plan and install EV charging infrastructure for their needs.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
        <Link
          href="/ev-station/triarc-ev-hub-bhadrachalam"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(16,185,129,0.25)] sm:px-7 sm:py-4 sm:text-base"
        >
          Find TRIARC EV Hub
          <ArrowRight size={18} />
        </Link>
        <Link
          href="/charging-solutions"
          className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/85 transition hover:border-emerald-400/40 hover:text-white sm:px-7 sm:py-4 sm:text-base"
        >
          Explore Charging Solutions
        </Link>
      </div>

      <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-white/45">{site.brand.tagline}</p>
    </div>
  );
}