"use client";

import { useState } from "react";
import Container from "@/components/Container";

export interface FaqItem {
  question: string;
  answer: string;
}

interface FaqProps {
  items: FaqItem[];
  title?: string;
}

export default function Faq({
  items,
  title = "Frequently Asked Questions",
}: FaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section
      aria-labelledby="faq-heading"
      className="relative overflow-hidden bg-[#04140f] py-14 sm:py-16 lg:py-20"
    >
      <Container>
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              FAQ
            </span>

            <h2
              id="faq-heading"
              className="mt-6 text-3xl font-black leading-tight text-white sm:text-4xl"
            >
              {title}
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
              Find answers to common questions about TRIARC EV Hub, EV
              charging and our charging infrastructure solutions.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {items.map((item, index) => {
              const isOpen = openIndex === index;
              const contentId = `faq-answer-${index}`;
              const buttonId = `faq-question-${index}`;

              return (
                <div
                  key={item.question}
                  className={[
                    "overflow-hidden rounded-2xl border transition-all duration-300",
                    isOpen
                      ? "border-emerald-400/30 bg-white/[0.055]"
                      : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  <h3 className="m-0">
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={contentId}
                      onClick={() => toggleItem(index)}
                      className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left sm:px-6 sm:py-6"
                    >
                      <span className="text-sm font-semibold leading-6 text-white sm:text-base">
                        {item.question}
                      </span>

                      <span
                        aria-hidden="true"
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-lg font-light transition-all duration-300",
                          isOpen
                            ? "rotate-0 border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                            : "border-white/15 bg-white/[0.03] text-white/70",
                        ].join(" ")}
                      >
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                  </h3>

                  <div
                    id={contentId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={[
                      "grid transition-[grid-template-rows] duration-300 ease-out",
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    ].join(" ")}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="border-t border-white/10 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                        <p className="text-sm leading-7 text-white/70 sm:text-base">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
