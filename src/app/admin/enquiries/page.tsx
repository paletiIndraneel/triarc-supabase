import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, RefreshCw } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";

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
  created_at: string;
};

export default async function EnquiriesPage() {
  const supabase = await createClient();

  const { data: enquiries, error } = await supabase
    .from("enquiries")
    .select("id, name, email, phone, message, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/enquiries] Failed to load enquiries:", error);
  }

  const rows = (enquiries ?? []) as Enquiry[];

  return (
    <main className="min-h-screen bg-[#f8f9ff] text-slate-900">
      <header className="h-16 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-full max-w-[1400px] items-center px-6">
          <Link href="/admin" className="mr-8 text-lg font-bold tracking-tight text-slate-900">
            Triarc EV ADMIN
          </Link>
          <nav className="flex h-full items-center gap-7 text-sm font-medium">
            <Link href="/admin/cms" className="text-slate-500 hover:text-slate-900">CMS Dashboard</Link>
            <Link href="/admin/billing" className="text-slate-500 hover:text-slate-900">Billing</Link>
            <Link href="/admin/enquiries" className="relative flex h-full items-center font-semibold text-violet-700">
              Enquiries
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-violet-600" />
            </Link>
          </nav>
          <div className="ml-auto text-sm text-slate-500">Admin</div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
          <ArrowLeft size={16} />
          Admin
        </Link>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Enquiries</h1>
            <p className="mt-1 text-sm text-slate-500">Messages submitted through the Visit Us form.</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {error ? (
          <GlassCard className="mt-7 border border-red-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-red-600">Unable to load enquiries right now. Please try again.</p>
          </GlassCard>
        ) : rows.length === 0 ? (
          <GlassCard className="mt-7 border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">No contact enquiries yet.</p>
          </GlassCard>
        ) : (
          <div className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold text-slate-600">Name</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-600">Message</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-600">Phone</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-600">Email</th>
                    <th className="px-5 py-3.5 font-semibold text-slate-600">Submitted</th>
                    <th className="px-5 py-3.5 text-right font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((enquiry) => (
                    <tr key={enquiry.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-5 py-4 font-semibold text-slate-900">{enquiry.name}</td>
                      <td className="max-w-[360px] px-5 py-4 text-slate-600">
                        <p className="whitespace-pre-wrap leading-6">{enquiry.message}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {enquiry.phone ? (
                          <a href={`tel:${enquiry.phone}`} className="hover:text-violet-700">{enquiry.phone}</a>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <a href={`mailto:${enquiry.email}`} className="inline-flex items-center gap-1.5 text-violet-700 hover:text-violet-900">
                          <Mail size={14} />
                          {enquiry.email}
                        </a>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                        {new Date(enquiry.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <a href={`mailto:${enquiry.email}`} aria-label="Email enquiry" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-violet-700">
                            <Mail size={15} />
                          </a>
                          {enquiry.phone && (
                            <a href={`tel:${enquiry.phone}`} aria-label="Call enquiry" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-violet-700">
                              <Phone size={15} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
