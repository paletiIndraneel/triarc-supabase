import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ExternalLink, ShieldCheck } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import LogoutButton from "@/components/Admin/LogoutButton";
import { site } from "@/data/site";
import { contact } from "@/data/contact";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-[#03110d] px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">Admin</p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Welcome back</h1>
            <p className="mt-2 text-sm text-white/60">Signed in to the {site.brand.fullName} admin area.</p>
          </div>
          <LogoutButton />
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <GlassCard className="p-6">
            <Mail className="text-emerald-300" size={22} />
            <h2 className="mt-3 text-lg font-bold text-white">Contact Inquiries</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Messages from the Visit Us form are emailed directly to {contact.email}. No submissions are stored in this dashboard.
            </p>
          </GlassCard>

          <GlassCard className="p-6">
            <ExternalLink className="text-emerald-300" size={22} />
            <h2 className="mt-3 text-lg font-bold text-white">Live Site</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">View the public {site.brand.name} site as visitors see it.</p>
            <Link href="/" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300 hover:text-emerald-200">
              Visit site
              <ExternalLink size={14} />
            </Link>
          </GlassCard>

          <GlassCard className="p-6">
            <ShieldCheck className="text-emerald-300" size={22} />
            <h2 className="mt-3 text-lg font-bold text-white">Session</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Your session is securely managed by Supabase. Sign out when you are finished.
            </p>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
