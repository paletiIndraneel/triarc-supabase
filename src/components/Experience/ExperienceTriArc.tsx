"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/Container";

const solutions = [
  {
    title: "EV Charging",
    description:
      "Convenient EV charging for drivers visiting Bhadrachalam and the surrounding area.",
    href: "/charging-solutions/ev-charging",
    image:
      "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=1400&q=85",
    alt: "Electric vehicle charging at an EV charging station",
  },
  {
    title: "DC Fast Charging",
    description:
      "Explore DC fast charging options designed to help EV drivers spend less time waiting.",
    href: "/charging-solutions/dc-fast-charging",
    image:
      "https://images.unsplash.com/photo-1617886322168-72e4c7b7b8b6?auto=format&fit=crop&w=1400&q=85",
    alt: "Electric vehicle connected to a fast charging station",
  },
  {
    title: "EV Charger Installation",
    description:
      "Charging infrastructure solutions for businesses, properties and suitable fleet requirements.",
    href: "/charging-solutions/charger-installation",
    image:
      "https://images.unsplash.com/photo-1625047509248-ec889cbff17f?auto=format&fit=crop&w=1400&q=85",
    alt: "EV charging infrastructure and charger installation",
  },
];

export default function ExperienceTriArc() {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollSolutions = (direction: "left" | "right") => {
    if (!carouselRef.current) return;

    const amount = carouselRef.current.clientWidth * 0.82;

    carouselRef.current.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  return (
    <section
      id="solutions"
      aria-labelledby="solutions-heading"
      className="relative overflow-hidden bg-[#071A14] py-14 sm:py-16 lg:py-20"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
            Charging Solutions
          </span>

          <h2
            id="solutions-heading"
            className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl"
          >
            Charging solutions for every journey
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
            From everyday EV charging to fast charging and charger
            installation, explore the solutions available from TRIARC EV Hub.
          </p>
        </div>

        <div className="mt-7 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => scrollSolutions("left")}
            aria-label="Previous charging solution"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          >
            ←
          </button>

          <button
            type="button"
            onClick={() => scrollSolutions("right")}
            aria-label="Next charging solution"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          >
            →
          </button>
        </div>

        <div
          ref={carouselRef}
          className="mt-5 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="TRIARC charging solutions"
        >
          {solutions.map((solution) => (
            <article
              key={solution.title}
              className="group w-[84%] shrink-0 snap-start overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.035] shadow-[0_20px_60px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1 hover:border-emerald-400/25 sm:w-[48%] lg:w-[32%]"
            >
              {/* Consistent 16:10 image frame */}
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <img
                  src={solution.image}
                  alt={solution.alt}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#071A14] via-transparent to-transparent opacity-80" />

                <div className="absolute bottom-4 left-4 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 backdrop-blur-md">
                  TRIARC EV Hub
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <h3 className="text-xl font-bold text-white sm:text-2xl">
                  {solution.title}
                </h3>

                <p className="mt-3 min-h-[72px] text-sm leading-7 text-white/65">
                  {solution.description}
                </p>

                <Link
                  href={solution.href}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
                >
                  Explore solution
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>Swipe to explore</span>
        </div>
      </Container>
    </section>
  );
}