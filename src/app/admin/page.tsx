import type { Metadata } from "next";
import AdminApp from "@/components/admin/AdminApp";
import { createClient } from "@/lib/supabase/server";

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

export default async function AdminPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enquiries")
    .select("id, name, email, phone, message, status, created_at")
    .order("created_at", { ascending: false });

  return <AdminApp enquiries={(data ?? []) as Enquiry[]} enquiryError={Boolean(error)} />;
}
