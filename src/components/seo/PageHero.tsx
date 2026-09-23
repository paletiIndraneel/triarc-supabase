import { ReactNode } from "react";
import Container from "@/components/Container";

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

/** Shared kicker + H1 + intro block for the marketing subpages, matching the homepage's visual language. */
export default function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_34%),#03110d] pb-12 pt-8 sm:pb-16">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
            {eyebrow}
          </span>
          <h1 className="mt-6 text-[clamp(2.1rem,4vw,3.4rem)] font-black leading-tight text-white [text-wrap:balance]">
            {title}
          </h1>
          <p className="mt-5 text-base leading-8 text-white/80 sm:text-lg">{description}</p>
          {children}
        </div>
      </Container>
    </section>
  );
}
