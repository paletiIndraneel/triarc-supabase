"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Zap } from "lucide-react";
import Container from "@/components/Container";
import { navigation } from "@/data/navigation";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <Container className="px-0 sm:px-0 lg:px-0 xl:px-0">
        <nav
          className={`mx-auto mt-3 flex h-16 items-center justify-between rounded-full border px-3 transition-all duration-500 ease-out sm:h-18 sm:px-6 ${
            scrolled
              ? "border-white/15 bg-emerald-950/70 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
              : "border-white/10 bg-white/5 backdrop-blur-xl"
          }`}
        >
          <Link href="#hero" className="flex items-center gap-3 rounded-full transition hover:opacity-90" aria-label="TriArc home">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <Zap size={18} />
            </div>
            <span className="font-[Space_Grotesk,sans-serif] text-lg font-bold tracking-tight text-white">
              TriArc
            </span>
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative text-sm font-medium text-white/75 transition-colors duration-300 hover:text-white focus-visible:outline-none focus-visible:text-white"
              >
                {item.label}
                <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500 opacity-0 transition-opacity duration-300 hover:opacity-100" />
              </Link>
            ))}
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:border-emerald-300/40 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 lg:hidden"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>

        {mobileOpen ? (
          <div className="mx-auto mt-3 rounded-[28px] border border-white/10 bg-emerald-950/80 p-4 shadow-2xl shadow-black/35 backdrop-blur-2xl lg:hidden">
            <div className="flex flex-col gap-2">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </Container>
    </header>
  );
}