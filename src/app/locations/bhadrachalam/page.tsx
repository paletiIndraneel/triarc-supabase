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
  title: "EV Charging Station in Bhadrachalam, Telangana | TRIARC EV Hub",
  description:
    "TRIARC EV Hub is an EV charging station in Bhadrachalam, Telangana, offering EV charging, DC fast charging and charging infrastructure for vehicles, businesses and fleets.",
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
        title="EV Charging Station in Bhadrachalam"
        description="TRIARC EV Hub operates an EV charging station in Bhadrachalam, Telangana, providing EV charging and charging infrastructure for vehicles, businesses and fleets across the region."
      />

      <section className="relative pb-14 sm:pb-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <GlassCard className="space-y-5 p-6 sm:p-8">
              <p className="text-base leading-8 text-white/80">
                Situated in the heart of Bhadrachalam, TRIARC EV Hub gives EV drivers a reliable place to charge while exploring the town or continuing their journey through Telangana. Our EV charging station supports everyday drivers as well as businesses and fleets that need dependable charging infrastructure.
              </p>
              <p className="text-base leading-8 text-white/80">
                TRIARC EV Hub Bhadrachalam offers EV charging and DC fast charging, along with commercial and fleet EV charging support, making it a practical stop for a wide range of electric vehicles.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <PrimaryButton href={contact.maps}>Get Directions</PrimaryButton>
                <Link
                  href="/stations/triarc-ev-hub-bhadrachalam"
                  className="inline-flex items-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:border-emerald-400/40 hover:text-white sm:px-7 sm:py-4 sm:text-base"
                >
                  View station details
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
                    <Link href="/solutions/ev-charging" className="transition hover:text-emerald-200">EV charging</Link>
                  </li>
                  <li>
                    <Link href="/solutions/dc-fast-charging" className="transition hover:text-emerald-200">DC fast charging</Link>
                  </li>
                  <li>
                    <Link href="/solutions/commercial-charging" className="transition hover:text-emerald-200">Commercial EV charging</Link>
                  </li>
                  <li>
                    <Link href="/solutions/fleet-charging" className="transition hover:text-emerald-200">Fleet EV charging</Link>
                  </li>
                </ul>
              </div>

              <Link
                href="/contact"
                className="inline-flex text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
              >
                Contact TRIARC EV Hub &rarr;
              </Link>
            </GlassCard>
          </div>
        </Container>
      </section>

      <Faq items={faqItems} title="Bhadrachalam EV Charging FAQ" />
    </main>
  );
}
