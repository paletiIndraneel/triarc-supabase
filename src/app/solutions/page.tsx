import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";
import PrimaryButton from "@/components/ui/PrimaryButton";
import PageHero from "@/components/seo/PageHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { solutions } from "@/data/solutions";

export const metadata: Metadata = {
  title: "EV Charging Solutions | TRIARC EV Hub",
  description:
    "Explore EV charging, DC fast charging, charger installation, commercial charging and fleet charging solutions from TRIARC EV Hub in Bhadrachalam, Telangana.",
  alternates: { canonical: "/solutions" },
};

export default function SolutionsPage() {
  return (
    <main className="bg-[#03110d]">
      <Breadcrumbs items={[{ name: "Solutions", url: "/solutions" }]} />
      <PageHero
        eyebrow="Solutions"
        title="EV Charging Solutions from TRIARC EV Hub"
        description="From everyday EV charging to commercial and fleet charging infrastructure, TRIARC EV Hub supports drivers and businesses across Bhadrachalam, Telangana."
      />

      <section className="relative pb-16 sm:pb-20">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {solutions.map((solution) => (
              <GlassCard key={solution.slug} className="flex h-full flex-col p-6">
                <h2 className="text-xl font-bold text-white">{solution.title}</h2>
                <p className="mt-3 flex-1 text-sm leading-7 text-white/75">{solution.summary}</p>
                <Link
                  href={`/solutions/${solution.slug}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
                >
                  Learn more <ArrowRight size={15} />
                </Link>
              </GlassCard>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <PrimaryButton href="/contact">Talk to TRIARC EV Hub</PrimaryButton>
          </div>
        </Container>
      </section>
    </main>
  );
}
