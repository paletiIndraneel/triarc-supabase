import Link from "next/link";
import { MapPin, MessageCircle, Phone, Zap } from "lucide-react";

import Container from "@/components/Container";
import { site } from "@/data/site";
import { contact } from "@/data/contact";

function InstagramIcon({ size = 17 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle
        cx="17.5"
        cy="6.5"
        r="0.8"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export default function Footer() {
  const whatsappLink = `https://wa.me/${contact.phoneHref.replace(
    /\D/g,
    ""
  )}`;

  const instagramUrl = site.social.instagram;
  const hasInstagramLink = 
    Boolean(instagramUrl) && instagramUrl !== "#";

  return (
    <footer className="relative overflow-hidden border-t border-emerald-400/10 bg-[#020d0a]">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-0 h-56 w-56 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute right-[10%] bottom-0 h-64 w-64 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <Container className="relative">
        {/* Main Footer */}
        <div className="grid gap-10 py-12 sm:py-14 lg:grid-cols-[1.5fr_0.9fr_0.9fr] lg:items-start lg:gap-12 xl:gap-16">
          {/* =========================
              BRAND / LOCATION
          ========================== */}
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

            {/* Address */}
            <a
              href={contact.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex items-start gap-3 text-sm leading-6 text-white/60 transition hover:text-emerald-300"
              aria-label="Open TRIARC EV Hub location in Google Maps"
            >
              <MapPin
                size={17}
                className="mt-0.5 shrink-0 text-emerald-300"
              />

              <span className="underline-offset-4 hover:underline">
                Park Road, Next to Kakatiya Residency
                <br />
                Bhadrachalam, Telangana 507111
              </span>
            </a>

            {/* Phone + WhatsApp side by side */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={`tel:${contact.phoneHref}`}
                className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-emerald-300"
              >
                <Phone
                  size={17}
                  className="shrink-0 text-emerald-300"
                />
                {contact.phone}
              </a>

              <span
                aria-hidden="true"
                className="text-white/20"
              >
                |
              </span>

              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-200"
                aria-label="Chat with TRIARC EV Hub on WhatsApp"
              >
                <MessageCircle size={16} />
                WhatsApp
              </a>
            </div>
          </div>

          {/* =========================
              QUICK LINKS
          ========================== */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              Quick Links
            </p>

            <nav
              aria-label="Footer navigation"
              className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2"
            >
              {site.navigation.map((item, index) => (
                <span
                  key={item.href}
                  className="flex items-center gap-3"
                >
                  <Link
                    href={item.href}
                    className="text-sm text-white/65 transition hover:text-white"
                  >
                    {item.label}
                  </Link>

                  {index < site.navigation.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="text-white/20"
                    >
                      |
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          {/* =========================
              FOLLOW US
          ========================== */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              Follow Us
            </p>

            <div className="mt-5">
              {hasInstagramLink ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/75 transition hover:border-emerald-400/40 hover:bg-white/10 hover:text-emerald-300"
                  aria-label="Follow TRIARC EV Hub on Instagram"
                >
                  <InstagramIcon size={17} />
                  Instagram
                </a>
              ) : (
                <span
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-white/35"
                  aria-label="Instagram profile link not configured"
                  title="Add the TRIARC Instagram profile URL in data/site.ts"
                >
                  <InstagramIcon size={17} />
                  Instagram
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} TRIARC EV Hub. All rights reserved.
          </p>

  
        </div>
      </Container>
    </footer>
  );
}