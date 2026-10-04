import type { Metadata } from "next";
import AdminHeader from "@/components/admin/AdminHeader";
import EnquiriesTable from "./EnquiriesTable";
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
      <AdminHeader />

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
