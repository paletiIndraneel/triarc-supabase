import Image from "next/image";
import { ExplorePlace } from "@/data/explore";

interface FeaturedPlaceCardProps {
  place: ExplorePlace;
  onSelect: (place: ExplorePlace) => void;
}

export default function FeaturedPlaceCard({ place, onSelect }: FeaturedPlaceCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(place)}
      className="motion-reveal group relative block w-full overflow-hidden rounded-[36px] border border-white/10 bg-white/5 text-left shadow-[0_20px_70px_rgba(0,0,0,0.25)]"
    >
      <div className="relative h-[360px] min-h-[360px] sm:h-[430px] sm:min-h-[430px] lg:h-[500px] lg:min-h-[500px]">
        <Image
          src={place.image}
          alt={place.title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
        <span className="rounded-full bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-white">
          {place.category}
        </span>
        <h3 className="mt-3 text-xl font-black text-white sm:text-2xl">{place.title}</h3>
        <p className="text-clamp-1 mt-2 max-w-md text-sm leading-7 text-white/80 sm:text-base">{place.description}</p>
      </div>
    </button>
  );
}