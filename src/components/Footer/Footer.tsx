import Link from "next/link";
import { ArrowUpRight, MapPin, Phone, Zap } from "lucide-react";
import Container from "@/components/Container";
import { site } from "@/data/site";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-emerald-400/10 bg-[#020d0a]">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[15%] top-0 h-56 w-56 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute right-[10%] bottom-0 h-64 w-64 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <Container className="relative">
        {/* Main footer */}
        <div className="grid gap-12 py-14 sm:py-16 lg:grid-cols-[1.4fr_0.7fr_0.9fr] lg:gap-16">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-3"
              aria-label="TRIARC EV Hub home"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                <Zap size={19} />
              </span>

              <span className="text-xl font-bold tracking-tight text-white">
                TRIARC
              </span>
            </Link>

            <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
              EV charging and charging infrastructure solutions in
              Bhadrachalam, Telangana.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 text-sm text-white/60">
                <MapPin
                  size={17}
                  className="mt-0.5 shrink-0 text-emerald-300"
                />

                <span>
                  Park Road, Next to Kakatiya Residency
                  <br />
                  Bhadrachalam, Telangana 507111
                </span>
              </div>

              <a
                href={`tel:${site.station.phone.replace(/\s+/g, "")}`}
                className="flex items-center gap-3 text-sm text-white/60 transition hover:text-emerald-300"
              >
                <Phone size={17} className="shrink-0 text-emerald-300" />
                {site.station.phone}
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              Quick Links
            </p>

            <nav className="mt-5 flex flex-col gap-3">
              <Link
                href="/"
                className="text-sm text-white/65 transition hover:text-white"
              >
                Home
              </Link>

              <Link
                href="/about"
                className="text-sm text-white/65 transition hover:text-white"
              >
                About
              </Link>

              <Link
                href="/charging-solutions"
                className="text-sm text-white/65 transition hover:text-white"
              >
                Charging Solutions
              </Link>

              <Link
                href="/contact"
                className="text-sm text-white/65 transition hover:text-white"
              >
                Contact
              </Link>
            </nav>
          </div>

          {/* Station CTA */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              Visit TRIARC
            </p>

            <h3 className="mt-5 max-w-xs text-2xl font-bold leading-tight text-white">
              Ready to charge?
            </h3>

            <Link
              href="/ev-station/triarc-ev-hub-bhadrachalam"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,185,129,0.2)]"
            >
              Find Our Station
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} TRIARC EV Hub. All rights reserved.
          </p>

          <div className="flex items-center gap-5">
            <Link
              href="/contact"
              className="transition hover:text-white"
            >
              Contact
            </Link>

            <Link
              href="/about"
              className="transition hover:text-white"
            >
              About TRIARC
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}