"use client";

import { useState } from "react";
import FeaturedPlaceCard from "./FeaturedPlaceCard";
import PlaceCard from "./PlaceCard";
import ExploreImageModal from "./ExploreImageModal";
import { places, ExplorePlace } from "@/data/explore";

const categories = Array.from(new Set(places.map((place) => place.category)));

/** Full place grid for the dedicated /explore-bhadrachalam page (distinct copy from the homepage teaser section). */
export default function ExploreBhadrachalamGrid() {
  const [selectedPlace, setSelectedPlace] = useState<ExplorePlace | null>(null);

  const featured = places.find((p) => p.featured);
  const others = places.filter((p) => !p.featured);

  return (
    <>
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <span
            key={category}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/60"
          >
            {category}
          </span>
        ))}
      </div>

      <div className="grid gap-7 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch lg:gap-10 xl:gap-12">
        {featured && (
          <div className="h-full">
            <FeaturedPlaceCard place={featured} onSelect={setSelectedPlace} />
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:mt-8 lg:grid-cols-3 lg:gap-5">
        {others.map((place) => (
          <PlaceCard key={place.id} place={place} onSelect={setSelectedPlace} />
        ))}
      </div>

      <ExploreImageModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
    </>
  );
}
