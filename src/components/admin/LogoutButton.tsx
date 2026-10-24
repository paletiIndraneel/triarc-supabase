"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

// Extra button attributes (role, tabIndex, data-*) pass through, e.g. for use as a menu item.
export default function LogoutButton({ compact = false, className, children, ...rest }: { compact?: boolean; className?: string; children?: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">) {
  async function handleLogout() {
    // Loaded on demand so the Supabase client is not in every public page bundle.
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    await supabase.auth.signOut();
    // The CMS dashboard caches customer PII in sessionStorage; it must not outlive the session.
    window.sessionStorage.clear();

    // A full load drops every in-memory cache too; absolute to say that's intended.
    window.location.assign(new URL("/signin", window.location.origin));
  }

  return (
    <button
      {...rest}
      type="button"
      onClick={handleLogout}
      className={className ?? (compact ? "rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-emerald-300/40 hover:bg-white/5" : "rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5")}
    >
      {children ?? "Sign Out"}
    </button>
  );
}
