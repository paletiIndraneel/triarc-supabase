import { Sparkles } from "lucide-react";

export default function HeroContent() {
  return (
    <div className="motion-reveal mx-auto flex w-full max-w-[38rem] flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
      <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.2)] backdrop-blur-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 text-sm font-bold text-emerald-100">
          T
        </div>
        <div className="text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Logo / Title Placeholder</p>
          <p className="text-sm font-semibold text-white/90">TriArc EV Hub</p>
        </div>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-[linear-gradient(120deg,rgba(16,185,129,0.24),rgba(110,231,183,0.2))] px-4 py-2 text-sm font-semibold tracking-[0.01em] text-emerald-50 shadow-[0_10px_34px_rgba(16,185,129,0.22)] backdrop-blur-md">
        <span className="rounded-full bg-emerald-300/20 p-1 text-emerald-100">
          <Sparkles size={13} />
        </span>
        <span className="bg-gradient-to-r from-emerald-50 via-lime-100 to-emerald-100 bg-clip-text text-transparent">
          Premium EV charging in Bhadrachalam
        </span>
      </div>

      <h1 className="mt-8 w-full text-[clamp(2.4rem,4.8vw,5.2rem)] font-black leading-[0.95] tracking-[-0.03em] text-white [text-wrap:balance]">
       Elevate your drive.
        <span className="mt-2 block bg-gradient-to-r from-emerald-300 via-emerald-400 to-lime-300 bg-clip-text text-transparent">
          Simplify your charge.
        </span>
      </h1>

      <p className="mt-6 max-w-[38rem] text-[clamp(1rem,1.2vw,1.2rem)] leading-7 text-white/80 sm:leading-8">
        Enjoy a seamless, safe, and beautifully designed charging experience from arrival to departure.
      </p> 
    </div>
  );
}