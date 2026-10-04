"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import AdminUserBadge from "@/components/admin/AdminUserBadge";

const navItems = [
  { label: "CMS Dashboard", href: "/admin/cms", key: "cms" },
  { label: "Billing", href: "/admin/billing", key: "billing" },
  { label: "Inventory", href: null, key: "inventory" },
  { label: "Enquiries", href: "/admin/enquiries", key: "enquiries" },
];

export default function AdminHeader() {
  const pathname = usePathname();
  const active =
    pathname === "/admin" || pathname.startsWith("/admin/cms")
      ? "cms"
      : pathname.startsWith("/admin/billing")
        ? "billing"
        : pathname.startsWith("/admin/enquiries")
          ? "enquiries"
          : "";

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-5 px-6">
        <Link
          href="/admin"
          className="flex shrink-0 items-center gap-2 text-[16px] font-bold tracking-tight text-slate-900"
        >
          Triarc EV
          <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-violet-700">
            ADMIN
          </span>
        </Link>

        <nav className="flex h-full items-center gap-1 text-sm font-medium" aria-label="Admin modules">
          {navItems.map((item) =>
            item.href ? (
              <Link
                key={item.key}
                href={item.href}
                className={
                  active === item.key
                    ? "rounded-xl bg-violet-600 px-3.5 py-2 font-semibold text-white"
                    : "rounded-xl px-3.5 py-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                }
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.key}
                aria-disabled="true"
                title="Inventory module is not connected yet"
                className="cursor-default rounded-xl px-3.5 py-2 text-slate-500"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="relative hidden xl:block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              aria-label="Portal search"
              placeholder="Search portal..."
              className="h-9 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 outline-none focus:border-violet-300 focus:bg-white"
            />
          </div>
          <button
            type="button"
            aria-label="Notifications"
            className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-600" />
          </button>
          <AdminUserBadge />
        </div>
      </div>
    </header>
  );
}
