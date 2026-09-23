import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, Clock3 } from "lucide-react";
import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";
import PrimaryButton from "@/components/ui/PrimaryButton";
import PageHero from "@/components/seo/PageHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import ContactForm from "@/components/Visit/ContactForm";
import { contact } from "@/data/contact";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Contact TRIARC EV Hub | Bhadrachalam, Telangana",
  description:
    "Get in touch with TRIARC EV Hub in Bhadrachalam, Telangana. Find our address, phone number, directions and an enquiry form for EV charging and infrastructure questions.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main className="bg-[#03110d]">
      <Breadcrumbs items={[{ name: "Contact", url: "/contact" }]} />
      <PageHero
        eyebrow="Contact"
        title="Contact TRIARC EV Hub"
        description="Reach out to TRIARC EV Hub for questions about EV charging, charger installation, or commercial and fleet charging in Bhadrachalam, Telangana."
      />

      <section className="relative pb-16 sm:pb-20">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
            <GlassCard className="space-y-5 p-6 sm:p-8">
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

              <div className="flex flex-wrap gap-3 pt-2">
                <PrimaryButton href={contact.maps}>Get Directions</PrimaryButton>
                <Link
                  href="/stations/triarc-ev-hub-bhadrachalam"
                  className="inline-flex items-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:border-emerald-400/40 hover:text-white sm:px-7 sm:py-4 sm:text-base"
                >
                  Station details
                </Link>
              </div>
            </GlassCard>

            <GlassCard className="p-6 sm:p-8">
              <h2 className="text-lg font-bold text-white">Send us a message</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Share your EV charging or infrastructure enquiry and our team will get back to you.
              </p>
              <ContactForm />
            </GlassCard>
          </div>
        </Container>
      </section>
    </main>
  );
}
