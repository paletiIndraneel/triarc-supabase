"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar/Navbar";

export default function PublicSiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <>
      {!isAdminRoute && <Navbar />}
      {children}
    </>
  );
}
