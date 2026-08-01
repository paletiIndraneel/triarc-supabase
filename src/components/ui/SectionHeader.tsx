import { ReactNode } from "react";

interface SectionHeaderProps {
  badge: string;
  title: ReactNode;
  description?: string;
  align?: "left" | "center";
}

export default function SectionHeader({
  badge,
  title,
  description,
  align = "center",
}: SectionHeaderProps) {
  return (
    <div
      className={`mb-14 sm:mb-16 ${
        align === "center"
          ? "mx-auto max-w-3xl text-center"
          : "max-w-3xl"
      }`}
    >
      <span className="inline-flex rounded-full border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-200 shadow-[0_8px_24px_rgba(16,185,129,0.12)]">
        {badge}
      </span>

      <h2 className="mt-6 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
        {title}
      </h2>

      {description && (
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/80 sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}