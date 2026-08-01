import { Clock3 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";

export default function ChargingStopBanner() {
  return (
    <GlassCard className="mx-auto mb-10 max-w-5xl border-emerald-400/20 bg-emerald-950/40 p-6 shadow-[0_16px_50px_rgba(3,16,13,0.3)] sm:p-8 lg:p-10">
      <div className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
            <Clock3 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-white/60">Typical charging stop</p>
            <h3 className="text-xl font-semibold text-white">30–45 minutes</h3>
          </div>
        </div>

        <p className="max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
          Make the most of your stop by exploring nearby attractions, local dining, and scenic destinations around TriArc EV Hub.
        </p>
      </div>
    </GlassCard>
  );
}