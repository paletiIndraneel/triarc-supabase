import type { ReactNode } from "react";
import { GROUP_NAME } from "@/components/admin/brand";
import RainGlassBackground from "@/components/ui/RainGlassBackground";

// The frame for sign-in, set-password and access-denied pages, on the admin's own palette so
// they match the admin they lead to. `background` puts the card on the rain-on-glass window;
// only sign-in asks for it, and there the card is frosted so the window reads through it.
export default function AuthShell({
  title,
  subtitle,
  background = false,
  children,
}: { title: string; subtitle?: string; background?: boolean; children: ReactNode }) {
  const card = (
    <div className="w-full max-w-md">
      <p className="mb-8 text-center text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{GROUP_NAME}</p>
      <section
        className={
          background
            ? "rounded-2xl border border-line/50 bg-surface/80 p-6 shadow-xl backdrop-blur-xl sm:p-8"
            : "rounded-2xl border border-line/80 bg-surface p-6 shadow-sm sm:p-8"
        }
      >
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
        {children}
      </section>
    </div>
  );

  if (background) {
    return (
      <main className="text-ink">
        <RainGlassBackground>{card}</RainGlassBackground>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-16 text-ink">{card}</main>
  );
}

// Shared form styles for these pages (same input look as the Access page).
export const authInputClass =
  "rounded-lg border border-line bg-raised px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-focus-ring/25";
export const authLabelClass = "grid gap-1.5 text-sm font-medium text-ink";
export const authButtonClass =
  "mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-ink transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60";
export const authErrorClass = "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700";
