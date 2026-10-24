import type { ReactNode } from "react";
import { GROUP_NAME } from "@/components/admin/brand";

// The frame for sign-in, set-password and access-denied pages, in the admin's own style
// (lavender ground, white card, violet accent) so they match the admin they lead to.
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-16 text-ink">
      <div className="w-full max-w-md">
        <p className="mb-6 flex items-center justify-center gap-2 font-bold">
          <span className="text-[16px] tracking-tight">{GROUP_NAME}</span>
          <span className="rounded-md bg-accent-pale px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-accent">ADMIN</span>
        </p>
        <section className="rounded-2xl border border-line/80 bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          {children}
        </section>
      </div>
    </main>
  );
}

// Shared form styles for these pages (same input look as the Access page).
export const authInputClass =
  "rounded-lg border border-line bg-raised px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-focus-ring/25";
export const authLabelClass = "grid gap-1.5 text-sm font-medium text-ink";
export const authButtonClass =
  "mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-ink transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60";
export const authErrorClass = "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700";
