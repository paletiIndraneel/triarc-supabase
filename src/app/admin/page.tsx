import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ExternalLink, ShieldCheck, Boxes } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const supabase = await createClient();

  let cmsEnabled = false;
  try {
    const context = await getCloudflareContext({ async: true });
    cmsEnabled =
      String(
        (context.env as unknown as Record<string, unknown>)
          .CMS_OPERATOR_DASHBOARD_ENABLED ?? ""
      ).toLowerCase() === "true";
  } catch {
    cmsEnabled =
      String(process.env.CMS_OPERATOR_DASHBOARD_ENABLED ?? "").toLowerCase() ===
      "true";
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Admin";
  const role = user?.user_metadata?.role || user?.user_metadata?.user_role || "Role not set";

  return (
    <main className="min-h-screen bg-[#03110d] px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Welcome {displayName} · {role}
            </h1>
          </div>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <GlassCard className="p-6">
            <ShieldCheck className="text-emerald-300" size={22} />
            <h2 className="mt-3 text-lg font-bold text-white">Billing</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Create bills, manage invoices, customers, and billing items.
            </p>
            <Link
              href="/admin/billing"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            >
              Open Billing
            </Link>
          </GlassCard>

          {cmsEnabled && (
            <GlassCard className="p-6">
              <ShieldCheck className="text-emerald-300" size={22} />
              <h2 className="mt-3 text-lg font-bold text-white">CMS Operator Dashboard</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                View ChargeMOD Power Line operations, charger totals, live transactions, and transaction history.
              </p>
              <Link
                href="/admin/cms"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
              >
                Open dashboard
              </Link>
            </GlassCard>
          )}

          <GlassCard className="p-6">
            <Mail className="text-emerald-300" size={22} />
            <h2 className="mt-3 text-lg font-bold text-white">Contact Inquiries</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              View messages submitted through the Visit Us form.
            </p>
            <Link
              href="/admin/enquiries"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            >
              View inquiries
            </Link>
          </GlassCard>

          <GlassCard className="p-6">
            <ExternalLink className="text-emerald-300" size={22} />
            <h2 className="mt-3 text-lg font-bold text-white">Live Site</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              View the public {site.brand.name} site as visitors see it.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            >
              Visit site
              <ExternalLink size={14} />
            </Link>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
