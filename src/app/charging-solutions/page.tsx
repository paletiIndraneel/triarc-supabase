import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";
import PrimaryButton from "@/components/ui/PrimaryButton";
import PageHero from "@/components/seo/PageHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { hubServices } from "@/data/solutions";

export const metadata: Metadata = {
  title: "EV Charging Solutions | TRIARC EV Hub",
  description:
    "Explore EV charging, charger installation, commercial charging and fleet charging solutions from TRIARC EV Hub in Bhadrachalam, Telangana.",
  alternates: { canonical: "/charging-solutions" },
};

export default function ChargingSolutionsPage() {
  return (
    <main className="bg-[#03110d]">
      <Breadcrumbs items={[{ name: "Charging Solutions", url: "/charging-solutions" }]} />
      <PageHero
        eyebrow="Charging Solutions"
        title="EV Charging Solutions for Every Requirement"
        description="Whether you're charging a personal EV, planning charging at a business location or managing an electric fleet, TRIARC provides practical EV charging and infrastructure solutions based on your requirements."
      />

      <section className="relative pb-16 sm:pb-20">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2">
            {hubServices.map((service) => (
              <GlassCard key={service.href} className="flex h-full flex-col p-6">
                <h2 className="text-xl font-bold text-white">{service.title}</h2>
                <p className="mt-3 flex-1 text-sm leading-7 text-white/75">{service.description}</p>
                <Link
                  href={service.href}
                  className="mt-5 inline-flex items-center text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
                >
                  {service.cta}
                </Link>
              </GlassCard>
            ))}
          </div>

          <div className="mt-10 flex justify-center">
            <PrimaryButton href="/contact">Talk to TRIARC</PrimaryButton>
          </div>
        </Container>
      </section>
    </main>
  );
}
