"use client";

export default function LogoutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  async function handleLogout() {
    // Loaded on demand so the Supabase client is not in every public page bundle.
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    await supabase.auth.signOut();
    // The CMS dashboard caches customer PII in sessionStorage; it must not outlive the session.
    window.sessionStorage.clear();

    window.location.href = "/signin";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={className ?? (compact ? "rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-emerald-300/40 hover:bg-white/5" : "rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5")}
    >
      Sign Out
    </button>
  );
}
