import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import PageHero from "@/components/seo/PageHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import ExploreBhadrachalamGrid from "@/components/Explore/ExploreBhadrachalamGrid";

export const metadata: Metadata = {
  title: "Explore Bhadrachalam | TRIARC EV Hub",
  description: "Explore places to visit, restaurants, cafés and accommodation around Bhadrachalam while visiting TRIARC EV Hub.",
  alternates: { canonical: "/explore-bhadrachalam" },
};

export default function ExploreBhadrachalamPage() {
  return (
    <main className="bg-[#03110d]">
      <Breadcrumbs items={[{ name: "Explore Bhadrachalam", url: "/explore-bhadrachalam" }]} />
      <PageHero
        eyebrow="Explore"
        title="Explore Bhadrachalam While You Charge"
        description="Your charging stop can be part of the journey. While your EV charges, discover places to eat, stay, visit and explore around Bhadrachalam."
      />

      <section className="relative pb-16 sm:pb-20">
        <Container>
          <ExploreBhadrachalamGrid />

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-7 text-white/60">
            Charging nearby?{" "}
            <Link href="/ev-station/triarc-ev-hub-bhadrachalam" className="font-semibold text-emerald-300 hover:text-emerald-200">
              Find TRIARC EV Hub
            </Link>{" "}
            or{" "}
            <Link href="/contact" className="font-semibold text-emerald-300 hover:text-emerald-200">
              contact us
            </Link>{" "}
            for directions.
          </p>
        </Container>
      </section>
    </main>
  );
}
