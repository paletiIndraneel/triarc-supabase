"use client";

import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    window.location.href = "/signin";
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5"
    >
      Sign Out
    </button>
  );
}
