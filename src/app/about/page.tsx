import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";
import PrimaryButton from "@/components/ui/PrimaryButton";
import PageHero from "@/components/seo/PageHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { contact } from "@/data/contact";

export const metadata: Metadata = {
  title: "About TRIARC EV Hub | EV Charging Infrastructure",
  description:
    "TRIARC EV Hub operates an EV charging station in Bhadrachalam, Telangana, and provides EV charger installation and charging infrastructure for businesses and fleets.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="bg-[#03110d]">
      <Breadcrumbs items={[{ name: "About", url: "/about" }]} />
      <PageHero
        eyebrow="About Us"
        title="About TRIARC EV Hub"
        description="TRIARC EV Hub operates an EV charging station in Bhadrachalam, Telangana, and supports the region's shift to electric mobility through reliable EV charging infrastructure."
      />

      <section className="relative pb-16 sm:pb-20">
        <Container>
          <GlassCard className="mx-auto max-w-3xl space-y-5 p-6 sm:p-8">
            <p className="text-base leading-8 text-white/80">
              TRIARC EV Hub runs an EV charging station in Bhadrachalam, Telangana, offering AC and DC fast charging for electric cars and three-wheelers. Our goal is to make EV charging simple, safe and dependable for everyone passing through Bhadrachalam.
            </p>
            <p className="text-base leading-8 text-white/80">
              Alongside operating our own charging station, TRIARC provides EV charger installation and EV charging infrastructure solutions, helping businesses and property owners bring charging online. We also support commercial EV charging and fleet EV charging for organisations operating electric vehicles in and around the region.
            </p>
            <p className="text-base leading-8 text-white/80">
              As EV adoption grows across Telangana, TRIARC EV Hub aims to be a dependable local partner for EV charging, charging infrastructure, and commercial and fleet charging needs.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <PrimaryButton href="/solutions">Explore our solutions</PrimaryButton>
              <Link
                href="/locations/bhadrachalam"
                className="inline-flex items-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:border-emerald-400/40 hover:text-white sm:px-7 sm:py-4 sm:text-base"
              >
                Visit Bhadrachalam station
              </Link>
            </div>

            <p className="border-t border-white/10 pt-5 text-sm leading-7 text-white/60">
              Have a question? Call us at{" "}
              <a href={`tel:${contact.phoneHref}`} className="font-semibold text-emerald-300 hover:text-emerald-200">
                {contact.phone}
              </a>{" "}
              or{" "}
              <Link href="/contact" className="font-semibold text-emerald-300 hover:text-emerald-200">
                contact us online
              </Link>
              .
            </p>
          </GlassCard>
        </Container>
      </section>
    </main>
  );
}
