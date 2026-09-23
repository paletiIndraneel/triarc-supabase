import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";
import PrimaryButton from "@/components/ui/PrimaryButton";
import PageHero from "@/components/seo/PageHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { solutions, getSolutionBySlug } from "@/data/solutions";

const solution = getSolutionBySlug("ev-charging")!;
const related = solutions.filter((s) => s.slug !== solution.slug);

export const metadata: Metadata = {
  title: solution.metaTitle,
  description: solution.description,
  alternates: { canonical: "/solutions/ev-charging" },
};

export default function EvChargingPage() {
  return (
    <main className="bg-[#03110d]">
      <Breadcrumbs items={[{ name: "Solutions", url: "/solutions" }, { name: solution.title, url: "/solutions/ev-charging" }]} />
      <PageHero eyebrow="EV Charging" title={solution.title} description={solution.description} />

      <section className="relative pb-14 sm:pb-16">
        <Container>
          <GlassCard className="mx-auto max-w-3xl space-y-5 p-6 sm:p-8">
            {solution.body.map((paragraph) => (
              <p key={paragraph} className="text-base leading-8 text-white/80">
                {paragraph}
              </p>
            ))}
          </GlassCard>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PrimaryButton href="/locations/bhadrachalam">Visit TRIARC EV Hub Bhadrachalam</PrimaryButton>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:border-emerald-400/40 hover:text-white sm:px-7 sm:py-4 sm:text-base"
            >
              Contact us
            </Link>
          </div>
        </Container>
      </section>

      <section className="relative bg-[#04140f] pb-16 pt-14 sm:pb-20">
        <Container>
          <h2 className="text-center text-2xl font-black text-white sm:text-3xl">Related Solutions</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <GlassCard key={item.slug} className="p-6">
                <h3 className="text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-white/75">{item.summary}</p>
                <Link
                  href={`/solutions/${item.slug}`}
                  className="mt-4 inline-flex text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
                >
                  Learn more
                </Link>
              </GlassCard>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
