import type { Metadata } from "next";
import AdminApp from "@/components/admin/AdminApp";
import { parseAdminModule } from "@/components/admin/adminNavigation";
import { getAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin",
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

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ module?: string | string[] }> }) {
  const { module } = await searchParams;
  // proxy.ts has already checked this is an active admin; this adds partner vs investor.
  const { supabase, isPartner } = await getAdminClient();
  const { data, error } = await supabase
    .from("enquiries")
    .select("id, name, email, phone, message, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <AdminApp
      enquiries={(data ?? []) as Enquiry[]}
      enquiryError={Boolean(error)}
      initialModule={parseAdminModule(typeof module === "string" ? module : null)}
      isPartner={isPartner}
    />
  );
}
