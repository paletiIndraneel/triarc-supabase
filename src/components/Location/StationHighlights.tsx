import Link from "next/link";
import { ArrowRight, Clock3, MapPin, Phone } from "lucide-react";
import Container from "@/components/Container";
import { contact } from "@/data/contact";
import { site } from "@/data/site";

export default function StationHighlights() {
  return (
    <section
      aria-labelledby="station-heading"
      className="relative overflow-hidden bg-[#04140f] py-14 sm:py-16 lg:py-20"
    >
      <Container>
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.025] p-5 sm:p-7 lg:p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
                  Bhadrachalam Station
                </span>

                <h2
                  id="station-heading"
                  className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl"
                >
                  {site.station.name}
                </h2>

                <div className="mt-5 space-y-3 text-sm leading-7 text-white/70 sm:text-base">
                  <p className="flex items-start gap-3">
                    <MapPin
                      size={18}
                      className="mt-1 shrink-0 text-emerald-300"
                    />
                    <span>{contact.address}</span>
                  </p>

                  <p className="flex items-center gap-3">
                    <Phone
                      size={18}
                      className="shrink-0 text-emerald-300"
                    />
                    <a
                      href={`tel:${contact.phoneHref}`}
                      className="transition hover:text-emerald-300"
                    >
                      {contact.phone}
                    </a>
                  </p>

                  <p className="flex items-center gap-3">
                    <Clock3
                      size={18}
                      className="shrink-0 text-emerald-300"
                    />
                    <span>{contact.hours}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <a
                  href={contact.maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
                >
                  Get Directions
                  <ArrowRight size={16} className="ml-2" />
                </a>

                <Link
                  href="/ev-station/triarc-ev-hub-bhadrachalam"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white/85 transition hover:border-emerald-400/40 hover:text-white"
                >
                  Station Details
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-center">
            <Link
              href="/locations/bhadrachalam"
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
            >
              Explore EV charging in Bhadrachalam
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}