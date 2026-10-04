"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import AdminUserBadge from "@/components/admin/AdminUserBadge";

const navItems = [
  { label: "CMS Dashboard", href: "/admin/cms", key: "cms" },
  { label: "Billing", href: "/admin/billing", key: "billing" },
  { label: "Inventory", href: "/admin/inventory", key: "inventory" },
  { label: "Enquiries", href: "/admin/enquiries", key: "enquiries" },
];

export default function AdminHeader() {
  const pathname = usePathname();
  const active =
    pathname === "/admin" || pathname.startsWith("/admin/cms")
      ? "cms"
      : pathname.startsWith("/admin/billing")
        ? "billing"
        : pathname.startsWith("/admin/inventory")
          ? "inventory"
          : pathname.startsWith("/admin/enquiries")
            ? "enquiries"
            : "";

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center gap-7 border-b border-[#e8e9f0] bg-white px-7 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
      <div className="flex min-w-[230px] shrink-0 items-center gap-[9px] whitespace-nowrap font-bold text-[#172033]">
        <Link href="/admin" className="text-[16px] font-bold tracking-tight text-[#172033]">
          Triarc EV
        </Link>
        <span className="rounded-md bg-[#eeeaff] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#7157d9]">
          ADMIN
        </span>
      </div>

      <nav className="flex h-full flex-1 items-center gap-1" aria-label="Admin modules">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={
              active === item.key
                ? "rounded-[10px] bg-[#7157d9] px-[14px] py-[9px] text-[13px] font-semibold text-white"
                : "rounded-[10px] px-[14px] py-[9px] text-[13px] font-semibold text-[#667085] transition hover:bg-[#f5f3ff] hover:text-[#5b46c4]"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-4 text-[#667085]">
        <div className="flex h-9 w-[190px] items-center gap-2 rounded-[10px] border border-[#e2e4ec] px-[11px] text-xs text-[#98a2b3]">
          <Search size={16} />
          <span>Search portal...</span>
        </div>
        <Bell size={18} />
        <AdminUserBadge />
      </div>
    </header>
  );
}
