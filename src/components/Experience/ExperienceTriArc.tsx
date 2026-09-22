import Image from "next/image";
import { ArrowRight } from "lucide-react";

import Container from "@/components/Container";
import PrimaryButton from "@/components/ui/PrimaryButton";
import SectionCurveDivider from "@/components/ui/SectionCurveDivider";
import HighlightItem from "./HighlightItem";
import { highlights } from "@/data/experience";

export default function ExperienceTriArc() {
  return (
    <section id="experience" className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_35%),#071A14] py-12 sm:py-16 lg:py-20 xl:py-24">
      <SectionCurveDivider variant="slope" tone="indigo" heightClass="h-14" />
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch lg:gap-14 xl:gap-20">
          <div className="motion-reveal relative mx-auto w-full max-w-[760px] overflow-hidden rounded-[36px] border border-white/10 bg-white/5 p-2 shadow-[0_30px_90px_rgba(0,0,0,0.25)] lg:h-full">
            <div className="relative h-[380px] w-full overflow-hidden rounded-[28px] sm:h-[450px] lg:h-full">
              <Image
                src="/images/stations/experience.png"
                alt="TriArc EV Hub charging station"
                fill
                className="h-full w-full rounded-[28px] object-cover object-center"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>

          <div className="motion-delay-1 flex h-full flex-col justify-center">
            <div className="max-w-2xl text-center sm:text-left">
              <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
                About TriArc
              </span>
              <h3 className="mt-6 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
                More than a charging stop. A calm, premium pause.
              </h3>
              <p className="mt-5 text-base leading-8 text-white/80 sm:text-lg">
                Whether you&apos;re stopping for a quick recharge or taking a longer break,
                TriArc blends dependable charging, thoughtful comfort, and a convenient
                location into a smooth experience from arrival to departure.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {highlights.map((item) => (
                <HighlightItem
                  key={item.title}
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}