import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";

export interface FaqItem {
  question: string;
  answer: string;
}

/** Static Q&A block reused across pages. Intentionally has no JSON-LD (FAQPage schema skipped for eligibility reasons). */
export default function Faq({ items, title = "Frequently Asked Questions" }: { items: FaqItem[]; title?: string }) {
  return (
    <section className="relative overflow-hidden bg-[#04140f] py-14 sm:py-16">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
            FAQ
          </span>
          <h2 className="mt-6 text-3xl font-black leading-tight text-white sm:text-4xl">{title}</h2>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-4">
          {items.map((item) => (
            <GlassCard key={item.question} className="p-5 sm:p-6">
              <h3 className="text-base font-bold text-white sm:text-lg">{item.question}</h3>
              <p className="mt-2 text-sm leading-7 text-white/75 sm:text-base">{item.answer}</p>
            </GlassCard>
          ))}
        </div>
      </Container>
    </section>
  );
}
