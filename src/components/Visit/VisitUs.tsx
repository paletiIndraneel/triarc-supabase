import Link from "next/link";
import { ArrowRight, MapPin, Phone } from "lucide-react";
import Container from "@/components/Container";
import { contact } from "@/data/contact";
import { site } from "@/data/site";

export default function VisitUs() {
  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="relative overflow-hidden bg-[#03110d] py-14 sm:py-16 lg:py-20"
    >
      <Container>
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[30px] border border-emerald-400/15 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_45%),#0a231b] p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
                  TRIARC EV Hub
                </span>

                <h2
                  id="contact-heading"
                  className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl"
                >
                  Ready to charge or plan your EV infrastructure?
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
                  Visit TRIARC EV Hub in Bhadrachalam or contact our team about
                  EV charging, charger installation, commercial charging and
                  fleet requirements.
                </p>

                <div className="mt-5 flex flex-col gap-3 text-sm text-white/70 sm:flex-row sm:flex-wrap">
                  <span className="inline-flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-300" />
                    {site.station.city}, {site.station.state}
                  </span>

                  <a
                    href={`tel:${contact.phoneHref}`}
                    className="inline-flex items-center gap-2 transition hover:text-emerald-300"
                  >
                    <Phone size={16} className="text-emerald-300" />
                    {contact.phone}
                  </a>
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
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-white transition hover:border-emerald-400/40"
                >
                  Contact TRIARC
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}