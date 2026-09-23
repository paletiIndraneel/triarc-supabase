import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, Clock3 } from "lucide-react";
import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";
import PrimaryButton from "@/components/ui/PrimaryButton";
import PageHero from "@/components/seo/PageHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import Faq from "@/components/seo/Faq";
import { contact } from "@/data/contact";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "EV Charging in Bhadrachalam, Telangana | TRIARC EV Hub",
  description: "Find EV charging and EV charging infrastructure solutions in Bhadrachalam, Telangana from TRIARC EV Hub.",
  alternates: { canonical: "/locations/bhadrachalam" },
};

const faqItems = [
  {
    question: "Where is TRIARC EV Hub located in Bhadrachalam?",
    answer: `TRIARC EV Hub is located on ${contact.addressLine1}, ${contact.addressLine2}.`,
  },
  {
    question: "What type of EV charging is available in Bhadrachalam?",
    answer:
      "TRIARC EV Hub offers EV charging in Bhadrachalam, including AC charging and DC fast charging for electric cars and three-wheelers.",
  },
  {
    question: "Does TRIARC EV Hub support commercial or fleet EV charging in Bhadrachalam?",
    answer:
      "Yes. TRIARC EV Hub provides commercial EV charging and fleet EV charging support for businesses operating in and around Bhadrachalam, Telangana.",
  },
  {
    question: "How can I contact TRIARC EV Hub Bhadrachalam?",
    answer: `You can call TRIARC EV Hub at ${contact.phone} or use the contact form on our Contact page.`,
  },
];

export default function BhadrachalamLocationPage() {
  return (
    <main className="bg-[#03110d]">
      <Breadcrumbs items={[{ name: "Bhadrachalam", url: "/locations/bhadrachalam" }]} />
      <PageHero
        eyebrow="Bhadrachalam, Telangana"
        title="EV Charging in Bhadrachalam, Telangana"
        description="TRIARC EV Hub provides EV charging in Bhadrachalam, Telangana, along with EV charger installation, commercial charging and fleet charging support for local EV infrastructure needs."
      />

      <section className="relative pb-14 sm:pb-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <GlassCard className="space-y-5 p-6 sm:p-8">
              <p className="text-base leading-8 text-white/80">
                Situated in Bhadrachalam, TRIARC EV Hub gives individual EV owners a place to charge while exploring the town or continuing their journey through Telangana, alongside support for businesses and fleets that need dependable charging infrastructure.
              </p>
              <p className="text-base leading-8 text-white/80">
                Beyond day-to-day EV charging, TRIARC works with businesses and property owners on charger installation, and with organisations on commercial and fleet EV charging requirements in and around Bhadrachalam.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <PrimaryButton href={contact.maps}>Get Directions</PrimaryButton>
                <Link
                  href="/ev-station/triarc-ev-hub-bhadrachalam"
                  className="inline-flex items-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:border-emerald-400/40 hover:text-white sm:px-7 sm:py-4 sm:text-base"
                >
                  Find TRIARC EV Hub
                </Link>
              </div>
            </GlassCard>

            <GlassCard className="space-y-4 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-white">{site.station.name}</h2>
              <div className="flex gap-3">
                <MapPin size={18} className="mt-0.5 shrink-0 text-emerald-300" />
                <p className="text-sm leading-7 text-white/75">
                  {contact.addressLine1}
                  <br />
                  {contact.addressLine2}
                </p>
              </div>
              <div className="flex gap-3">
                <Phone size={18} className="mt-0.5 shrink-0 text-emerald-300" />
                <a href={`tel:${contact.phoneHref}`} className="text-sm text-white/75 transition hover:text-emerald-200">
                  {contact.phone}
                </a>
              </div>
              <div className="flex gap-3">
                <Clock3 size={18} className="mt-0.5 shrink-0 text-emerald-300" />
                <p className="text-sm text-white/75">{contact.hours}</p>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Services</p>
                <ul className="mt-3 space-y-2 text-sm text-white/75">
                  <li>
                    <Link href="/charging-solutions/ev-charging" className="transition hover:text-emerald-200">EV charging</Link>
                  </li>
                  <li>
                    <Link href="/charging-solutions/dc-fast-charging" className="transition hover:text-emerald-200">DC fast charging</Link>
                  </li>
                  <li>
                    <Link href="/charging-solutions/commercial-ev-charging" className="transition hover:text-emerald-200">Commercial EV charging</Link>
                  </li>
                  <li>
                    <Link href="/charging-solutions/fleet-charging" className="transition hover:text-emerald-200">Fleet EV charging</Link>
                  </li>
                </ul>
              </div>

              <Link
                href="/contact"
                className="inline-flex text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
              >
                Contact Us &rarr;
              </Link>
            </GlassCard>
          </div>
        </Container>
      </section>

      <Faq items={faqItems} title="Bhadrachalam EV Charging FAQ" />
    </main>
  );
}
