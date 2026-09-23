import Link from "next/link";
import { Zap } from "lucide-react";
import Container from "@/components/Container";
import SectionCurveDivider from "@/components/ui/SectionCurveDivider";

const footerLinks = [
  {
    heading: "Solutions",
    links: [
      { label: "EV Charging", href: "/solutions/ev-charging" },
      { label: "DC Fast Charging", href: "/solutions/dc-fast-charging" },
      { label: "Charger Installation", href: "/solutions/charger-installation" },
      { label: "Commercial Charging", href: "/solutions/commercial-charging" },
      { label: "Fleet Charging", href: "/solutions/fleet-charging" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About TRIARC EV Hub", href: "/about" },
      { label: "Bhadrachalam Location", href: "/locations/bhadrachalam" },
      { label: "TRIARC EV Hub Bhadrachalam", href: "/stations/triarc-ev-hub-bhadrachalam" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#03110d] py-10 sm:py-12 lg:py-14">
      <SectionCurveDivider variant="slope" tone="blue" heightClass="h-12" className="opacity-80" />
      <Container>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <Zap size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/70">TriArc</p>
              <p className="mt-1 text-sm text-white/50">
                TRIARC EV Hub &mdash; EV charging station in Bhadrachalam, Telangana.
              </p>
            </div>
          </div>

          {footerLinks.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">{group.heading}</p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-white/70 transition hover:text-emerald-300">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <p className="text-sm text-white/50">
            &copy; {new Date().getFullYear()} TriArc EV Hub. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}

