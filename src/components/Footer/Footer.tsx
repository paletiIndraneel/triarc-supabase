import { Zap } from "lucide-react";
import Container from "@/components/Container";
import SectionCurveDivider from "@/components/ui/SectionCurveDivider";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#03110d] py-10 sm:py-12 lg:py-14">
      <SectionCurveDivider variant="slope" tone="blue" heightClass="h-12" className="opacity-80" />
      <Container>
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <Zap size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/70">TriArc</p>
              <p className="text-sm text-white/50">Premium EV charging</p>
            </div>
          </div>

          <p className="text-sm text-white/50">
            &copy; {new Date().getFullYear()} TriArc EV Hub. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
