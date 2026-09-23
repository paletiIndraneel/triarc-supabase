import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, Clock3, ArrowRight } from "lucide-react";

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
    "Visit TRIARC EV Hub on Park Road in Bhadrachalam, Telangana for EV charging.",
  alternates: {
    canonical: "/ev-station/triarc-ev-hub-bhadrachalam",
  },
};

const amenities = [
  "Open 24 × 7",
  "Wi-Fi",
  "Parking",
];

export default function TriarcEvHubBhadrachalamPage() {
  return (
    <main className="bg-[#03110d]">
      <Breadcrumbs
        items={[
          {
            name: "TRIARC EV Hub Bhadrachalam",
            url: "/ev-station/triarc-ev-hub-bhadrachalam",
          },
        ]}
      />

      <PageHero
        eyebrow="EV Charging Station"
        title="TRIARC EV Hub Bhadrachalam"
        description="TRIARC EV Hub is located on Park Road, next to Kakatiya Residency, Bhadrachalam, Telangana."
      />

      <section className="relative pb-16 sm:pb-20">
        <Container>
          {/* Station information */}
          <GlassCard className="mx-auto max-w-4xl p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              {/* Details */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
                  Station Details
                </p>

                <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                  {site.station.name}
                </h2>

                <div className="mt-6 space-y-4">
                  {/* Address */}
                  <div className="flex gap-3">
                    <MapPin
                      size={19}
                      className="mt-1 shrink-0 text-emerald-300"
                    />

                    <p className="text-sm leading-7 text-white/70 sm:text-base">
                      {contact.addressLine1}
                      <br />
                      {contact.addressLine2}
                    </p>
                  </div>

                  {/* Hours */}
                  <div className="flex items-center gap-3">
                    <Clock3
                      size={19}
                      className="shrink-0 text-emerald-300"
                    />

                    <p className="text-sm text-white/70 sm:text-base">
                      {contact.hours}
                    </p>
                  </div>

                  {/* Phone */}
                  <a
                    href={`tel:${contact.phoneHref}`}
                    className="flex items-center gap-3 text-sm text-white/60 transition hover:text-emerald-300 sm:text-base"
                  >
                    <Phone
                      size={19}
                      className="shrink-0 text-emerald-300"
                    />

                    {contact.phone}
                  </a>
                </div>
              </div>

              {/* Primary action */}
              <div className="shrink-0 lg:pr-2">
                <PrimaryButton href={contact.maps}>
                  Get Directions
                  <ArrowRight size={17} />
                </PrimaryButton>
              </div>
            </div>

           {/* Amenities */}
<div className="mt-8 border-t border-white/10 pt-6">
  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/40">
    Amenities
  </p>

  <div className="mt-4 flex flex-wrap gap-2">
    {amenities.map((amenity) => (
      <span
        key={amenity}
        className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/65"
      >
        {amenity}
      </span>
    ))}
  </div>
</div>
          </GlassCard>
        </Container>
      </section>
    </main>
  );
}