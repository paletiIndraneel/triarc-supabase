import Image from "next/image";
import GlassCard from "@/components/ui/GlassCard";
import { ExplorePlace } from "@/data/explore";

interface PlaceCardProps {
  place: ExplorePlace;
  onSelect: (place: ExplorePlace) => void;
}

export default function PlaceCard({ place, onSelect }: PlaceCardProps) {
  return (
    <GlassCard className="motion-reveal group overflow-hidden bg-white/5 p-0 shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
      <button type="button" onClick={() => onSelect(place)} className="block w-full text-left">
        <div className="relative aspect-[16/10] min-h-[220px] overflow-hidden sm:min-h-[240px] lg:min-h-[260px]">
          <Image
            src={place.image}
            alt={place.title}
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
          />
        </div>

        <div className="p-5 sm:p-6">
          <span className="text-sm font-semibold text-emerald-400">{place.category}</span>
          <h3 className="mt-2 text-xl font-bold text-white">{place.title}</h3>
          <p className="text-clamp-2 mt-3 text-sm leading-7 text-white/70">{place.description}</p>
        </div>
      </button>
    </GlassCard>
  );
}