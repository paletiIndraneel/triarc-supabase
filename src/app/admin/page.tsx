import type { Metadata } from "next";
import CmsDashboard from "@/app/admin/cms/page";

export const metadata: Metadata = {
  title: "CMS Dashboard",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <CmsDashboard />;
}
