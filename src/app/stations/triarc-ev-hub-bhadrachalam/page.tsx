import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, Clock3, AlertCircle } from "lucide-react";
import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";
import PrimaryButton from "@/components/ui/PrimaryButton";
import PageHero from "@/components/seo/PageHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { contact } from "@/data/contact";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "TRIARC EV Hub Bhadrachalam | EV Charging Station",
  description:
    "TRIARC EV Hub Bhadrachalam is an EV charging station on Park Road, next to Kakatiya Residency, Bhadrachalam, Telangana. Get directions, contact details and services.",
  alternates: { canonical: "/stations/triarc-ev-hub-bhadrachalam" },
};

const verificationNeeded = [
  "Charger type",
  "Connector type",
  "Charging power",
  "Number of chargers",
  "Pricing",
  "Amenities",
  "Real-time availability",
];

export default function TriarcEvHubBhadrachalamPage() {
  return (
    <main className="bg-[#03110d]">
      <Breadcrumbs
        items={[
          { name: "Bhadrachalam", url: "/locations/bhadrachalam" },
          { name: "TRIARC EV Hub Bhadrachalam", url: "/stations/triarc-ev-hub-bhadrachalam" },
        ]}
      />
      <PageHero
        eyebrow="EV Charging Station"
        title="TRIARC EV Hub Bhadrachalam"
        description="TRIARC EV Hub Bhadrachalam is our EV charging station on Park Road, next to Kakatiya Residency, in Bhadrachalam, Telangana."
      />

      <section className="relative pb-14 sm:pb-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
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

              <div className="flex flex-wrap gap-3 pt-2">
                <PrimaryButton href={contact.maps}>Get Directions</PrimaryButton>
                <Link
                  href="/contact"
                  className="inline-flex items-center rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white/80 transition hover:border-emerald-400/40 hover:text-white sm:px-7 sm:py-4 sm:text-base"
                >
                  Contact us
                </Link>
              </div>
            </GlassCard>

            <GlassCard className="space-y-4 p-6 sm:p-8">
              <div className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-300" />
                <p className="text-sm leading-6 text-amber-100/90">
                  TODO: the details below require verification before publishing final specifications.
                </p>
              </div>
              <ul className="space-y-2 text-sm text-white/75">
                {verificationNeeded.map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
                    {item}: <span className="text-white/45">TODO — verify</span>
                  </li>
                ))}
              </ul>

              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Services available</p>
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
            </GlassCard>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-7 text-white/60">
            Looking for more on the area? Visit our{" "}
            <Link href="/locations/bhadrachalam" className="font-semibold text-emerald-300 hover:text-emerald-200">
              Bhadrachalam location page
            </Link>{" "}
            for local EV charging information, or{" "}
            <Link href="/contact" className="font-semibold text-emerald-300 hover:text-emerald-200">
              get in touch
            </Link>{" "}
            with our team.
          </p>
        </Container>
      </section>
    </main>
  );
}
