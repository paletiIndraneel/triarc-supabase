import { Sparkles } from "lucide-react";

export default function HeroContent() {
  return (
    <div className="motion-reveal mx-auto flex w-full max-w-[38rem] flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-[linear-gradient(120deg,rgba(16,185,129,0.24),rgba(110,231,183,0.2))] px-4 py-2 text-sm font-semibold tracking-[0.01em] text-emerald-50 shadow-[0_10px_34px_rgba(16,185,129,0.22)] backdrop-blur-md">
        <span className="rounded-full bg-emerald-300/20 p-1 text-emerald-100">
          <Sparkles size={13} />
        </span>
        <span className="bg-gradient-to-r from-emerald-50 via-lime-100 to-emerald-100 bg-clip-text text-transparent">
          Premium EV charging in Bhadrachalam
        </span>
      </div>

      <h1 className="mt-8 w-full text-[clamp(2.4rem,4.8vw,5.2rem)] font-black leading-[0.95] tracking-[-0.03em] text-white [text-wrap:balance]">
        EV Charging Station in
        <span className="mt-2 block bg-gradient-to-r from-emerald-300 via-emerald-400 to-lime-300 bg-clip-text text-transparent">
          Bhadrachalam, Telangana
        </span>
      </h1>

      <p className="mt-6 max-w-[38rem] text-[clamp(1rem,1.2vw,1.2rem)] leading-7 text-white/80 sm:leading-8">
        Elevate your drive and simplify your charge — TRIARC EV Hub delivers reliable EV charging and charging infrastructure for vehicles, businesses and fleets in Bhadrachalam.
      </p> 
    </div>
  );
}