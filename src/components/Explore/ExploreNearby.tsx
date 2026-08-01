"use client";

import { useState } from "react";
import Container from "@/components/Container";
import FeaturedPlaceCard from "./FeaturedPlaceCard";
import PlaceCard from "./PlaceCard";
import ExploreImageModal from "./ExploreImageModal";
import { places, ExplorePlace } from "@/data/explore";

export default function ExploreNearby() {
  const [selectedPlace, setSelectedPlace] = useState<ExplorePlace | null>(null);

  const featured = places.find((p) => p.featured);
  const others = places.filter((p) => !p.featured);

  return (
    <section id="explore" className="relative mt-14 overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.11),_transparent_30%),#061912] pb-24 pt-20 sm:mt-16 sm:pb-28 sm:pt-24 lg:mt-20 lg:pb-32 lg:pt-28 xl:pb-36 xl:pt-32">
      <Container>
        <div className="grid gap-7 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch lg:gap-10 xl:gap-12">
          {featured && (
            <div className="h-full">
              <FeaturedPlaceCard place={featured} onSelect={setSelectedPlace} />
            </div>
          )}

          <div className="motion-reveal flex h-full w-full flex-col justify-center items-center text-center sm:items-start sm:text-left lg:max-w-[34rem] lg:items-start lg:pb-2 lg:pl-4 lg:text-left xl:pl-6">
            <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              Explore
            </span>
            <h2 className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl lg:max-w-[12ch] lg:text-[2.95rem]">
              Beyond the charging station
            </h2>
            <p className="mt-5 text-base leading-8 text-white/80 sm:text-lg lg:max-w-[42ch]">
              Your journey does not pause while your EV charges. Discover nearby landmarks, local dining, scenic riverfront views, and comfortable stays, all within minutes of TriArc EV Hub.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:mt-8 lg:grid-cols-3 lg:gap-5">
          {others.map((place) => (
            <PlaceCard key={place.id} place={place} onSelect={setSelectedPlace} />
          ))}
        </div>
      </Container>

      <ExploreImageModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
    </section>
  );
}