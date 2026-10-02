import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Contact Inquiries",
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
    <main className="min-h-screen bg-[#03110d] px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
        >
          <ArrowLeft size={16} />
          Back to Admin
        </Link>

        <header className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Contact
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Contact Inquiries
          </h1>
          <p className="mt-3 text-white/60">
            Messages submitted through the Visit Us form.
          </p>
        </header>

        {error ? (
          <GlassCard className="mt-8 p-6">
            <p className="text-red-300">
              Unable to load enquiries right now. Please try again.
            </p>
          </GlassCard>
        ) : rows.length === 0 ? (
          <GlassCard className="mt-8 p-8">
            <p className="text-white/60">No contact inquiries yet.</p>
          </GlassCard>
        ) : (
          <div className="mt-8 space-y-4">
            {rows.map((enquiry) => (
              <GlassCard key={enquiry.id} className="p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <h2 className="text-xl font-bold text-white">
                        {enquiry.name}
                      </h2>
                      <a
                        href={`mailto:${enquiry.email}`}
                        className="inline-flex items-center gap-1.5 text-sm text-emerald-300 hover:text-emerald-200"
                      >
                        <Mail size={15} />
                        {enquiry.email}
                      </a>
                      {enquiry.phone && (
                        <a
                          href={`tel:${enquiry.phone}`}
                          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
                        >
                          <Phone size={15} />
                          {enquiry.phone}
                        </a>
                      )}
                    </div>

                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/80">
                      {enquiry.message}
                    </p>
                  </div>

                  <time
                    dateTime={enquiry.created_at}
                    className="shrink-0 text-sm text-white/40"
                  >
                    {new Date(enquiry.created_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
