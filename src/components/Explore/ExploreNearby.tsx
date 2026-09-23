"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";
import ExploreImageModal from "./ExploreImageModal";
import { places, ExplorePlace } from "@/data/explore";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ExploreNearby() {
  const [selectedPlace, setSelectedPlace] =
    useState<ExplorePlace | null>(null);

  const sliderRef = useRef<HTMLDivElement>(null);

  const scrollNext = () => {
    sliderRef.current?.scrollBy({
      left: sliderRef.current.clientWidth / 3 + 20,
      behavior: "smooth",
    });
  };

  const scrollPrevious = () => {
    sliderRef.current?.scrollBy({
      left: -(sliderRef.current.clientWidth / 3 + 20),
      behavior: "smooth",
    });
  };

  return (
    <section
      id="explore"
      className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.11),_transparent_30%),#061912] pb-16 pt-16 sm:pb-20 sm:pt-20 lg:pb-24"
    >
      <Container>

        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
            Explore
          </span>

          <h2 className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl">
            Beyond the charging station
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/75 sm:text-lg">
            Make the most of your stop at TRIARC EV Hub. Explore nearby
            landmarks, dining, riverfront views and places to stay.
          </p>
        </div>

        {/* Carousel Controls */}
        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={scrollPrevious}
            aria-label="Previous places"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:border-emerald-400/40 hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            type="button"
            onClick={scrollNext}
            aria-label="Next places"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:border-emerald-400/40 hover:bg-white/10 hover:text-white"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Carousel */}
        <div
          ref={sliderRef}
          className="mt-5 flex gap-5 overflow-hidden scroll-smooth"
        >
          {places.map((place) => (
            <div
              key={place.id}
              className="
                min-w-full
                sm:min-w-[calc((100%-20px)/2)]
                lg:min-w-[calc((100%-40px)/3)]
              "
            >
              <GlassCard className="group h-full overflow-hidden bg-white/5 p-0 shadow-[0_16px_50px_rgba(0,0,0,0.18)]">
                <button
                  type="button"
                  onClick={() => setSelectedPlace(place)}
                  className="block h-full w-full text-left"
                >
                  {/* Equal Image */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <Image
                      src={place.image}
                      alt={place.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />

                    {/* Category */}
                    <div className="absolute bottom-4 left-4">
                      <span className="inline-flex rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                        {place.category}
                      </span>
                    </div>
                  </div>

                  {/* Title Only */}
                  <div className="flex min-h-[92px] items-center px-6 py-5">
                    <h3 className="text-xl font-bold leading-tight text-white">
                      {place.title}
                    </h3>
                  </div>
                </button>
              </GlassCard>
            </div>
          ))}
        </div>

      </Container>

      <ExploreImageModal
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
      />
    </section>
  );
}