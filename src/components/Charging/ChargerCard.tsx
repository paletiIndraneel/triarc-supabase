import Image from "next/image";
import GlassCard from "@/components/ui/GlassCard";
import { chargingSolutions } from "@/data/charging";

type ChargingSolution = (typeof chargingSolutions)[number];

interface Props {
  charger: ChargingSolution;
  featured?: boolean;
}

export default function ChargerCard({ charger, featured = false }: Props) {
  return (
    <GlassCard className="motion-reveal group flex h-full flex-col overflow-hidden bg-[#10241B]/80 p-0 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className={`relative overflow-hidden ${featured ? "h-[240px] sm:h-[280px] lg:h-[320px]" : "h-[210px] sm:h-[235px] lg:h-[260px]"}`}>
        <Image
          src={charger.image}
          alt={charger.title}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white sm:left-6 sm:top-6 sm:text-sm">
          {charger.badge}
        </span>

        <div className={`absolute inset-x-0 bottom-0 ${featured ? "p-5 sm:p-6 lg:p-7" : "p-5 sm:p-6"}`}>
          <h3 className={`font-black text-white ${featured ? "text-2xl sm:text-3xl" : "text-2xl"}`}>
            {charger.title}
          </h3>
          <p className={`mt-2 max-w-[58ch] text-white/80 ${featured ? "text-clamp-2 text-sm leading-6 sm:text-[0.95rem]" : "text-clamp-2 text-sm leading-6"}`}>
            {charger.description}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}