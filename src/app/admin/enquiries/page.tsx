import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Search } from "lucide-react";
import EnquiriesTable from "./EnquiriesTable";
import { createClient } from "@/lib/supabase/server";
import AdminUserBadge from "@/components/admin/AdminUserBadge";

export const metadata: Metadata = {
  title: "Enquiries",
  robots: { index: false, follow: false },
};

type Enquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "New" | "Contacted" | "Closed";
  created_at: string;
};

export default async function EnquiriesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("enquiries")
    .select("id, name, email, phone, message, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/enquiries] Failed to load enquiries:", error);
  }

  const rows = (data ?? []) as Enquiry[];

  return (
    <main className="min-h-screen bg-[#f8f9ff] text-slate-900">
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1440px] items-center gap-5 px-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2 text-[17px] font-bold tracking-tight text-slate-900">
            Triarc EV
            <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">ADMIN</span>
          </Link>

          <nav className="flex h-full items-center gap-1 text-sm font-medium">
            <Link href="/admin/cms" className="rounded-xl px-3.5 py-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">CMS Dashboard</Link>
            <Link href="/admin/billing" className="rounded-xl px-3.5 py-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">Billing</Link>
            <span className="rounded-xl bg-violet-100 px-3.5 py-2 font-semibold text-violet-800">Enquiries</span>
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <div className="relative hidden xl:block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input aria-label="Portal search" placeholder="Search portal..." className="h-9 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-violet-300 focus:bg-white" />
            </div>
            <button type="button" aria-label="Notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-600" />
            </button>
            <div className="hidden sm:block"><AdminUserBadge /></div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-6 pb-12 pt-24">
        <div className="mb-7">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Enquiries</h1>
          <p className="mt-1 text-sm text-slate-500">View and manage enquiries submitted through the Triarc website.</p>
        </div>

        <EnquiriesTable enquiries={rows} error={!!error} />
      </div>
    </main>
  );
}
