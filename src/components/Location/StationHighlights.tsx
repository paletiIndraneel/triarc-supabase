import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";

const highlights = [
  {
    title: "EV Charger Installation",
    description:
      "TRIARC provides EV charger installation and EV charging infrastructure for businesses and property owners across the region.",
    href: "/solutions/charger-installation",
    cta: "Charger installation",
  },
  {
    title: "Fleet EV Charging",
    description:
      "Dedicated fleet EV charging support for organisations managing multiple electric vehicles across Telangana.",
    href: "/solutions/fleet-charging",
    cta: "Fleet charging",
  },
];

/** Homepage section covering charger installation, fleet programs, and the Bhadrachalam location — distinct from the charging-type cards above, with links into the dedicated pages. */
export default function StationHighlights() {
  return (
    <section className="relative overflow-hidden bg-[#04140f] pb-16 pt-14 sm:pb-20 sm:pt-16">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
            TRIARC EV Hub &mdash; Bhadrachalam
          </span>
          <h2 className="mt-6 text-3xl font-black leading-tight text-white sm:text-4xl">
            Charging Infrastructure Built for Bhadrachalam, Telangana
          </h2>
          <p className="mt-5 text-base leading-8 text-white/80 sm:text-lg">
            Beyond charging your vehicle on-site, TRIARC EV Hub helps bring EV charging infrastructure to businesses and supports fleet operators across the region.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:mx-auto sm:max-w-3xl">

          {highlights.map((item) => (
            <GlassCard key={item.href} className="flex h-full flex-col p-6">
              <h3 className="text-lg font-bold text-white">{item.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-7 text-white/75">{item.description}</p>
              <Link
                href={item.href}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 transition hover:text-emerald-200"
              >
                {item.cta} <ArrowRight size={15} />
              </Link>
            </GlassCard>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-white/70">
          <Link
            href="/locations/bhadrachalam"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 font-semibold text-white/85 transition hover:border-emerald-400/40 hover:text-white"
          >
            EV Charging Station in Bhadrachalam
          </Link>
          <Link
            href="/stations/triarc-ev-hub-bhadrachalam"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 font-semibold text-white/85 transition hover:border-emerald-400/40 hover:text-white"
          >
            TRIARC EV Hub Bhadrachalam station details
          </Link>
        </div>
      </Container>
    </section>
  );
}
