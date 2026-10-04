"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase/billing";

export default function AdminUserBadge() {
  const [name, setName] = useState("Loading…");
  const [role, setRole] = useState("Loading…");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const user = data.user;
      const metadata = user?.user_metadata ?? {};
      const appMetadata = user?.app_metadata ?? {};

      const displayName =
        typeof metadata.display_name === "string" && metadata.display_name.trim()
          ? metadata.display_name.trim()
          : typeof metadata.full_name === "string" && metadata.full_name.trim()
            ? metadata.full_name.trim()
            : typeof metadata.name === "string" && metadata.name.trim()
              ? metadata.name.trim()
              : user?.email?.split("@")[0] || "User";

      const userRole =
        typeof appMetadata.role === "string" && appMetadata.role.trim()
          ? appMetadata.role.trim()
          : typeof metadata.role === "string" && metadata.role.trim()
            ? metadata.role.trim()
            : typeof metadata.user_role === "string" && metadata.user_role.trim()
              ? metadata.user_role.trim()
              : "Role not set";

      setName(displayName);
      setRole(userRole);
    }

    void loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserRound size={18} className="shrink-0 text-slate-600" />
      <span className="min-w-0 leading-tight">
        <b className="block max-w-[150px] truncate text-xs font-bold text-slate-900">{name}</b>
        <small className="block max-w-[150px] truncate text-[10px] text-slate-500">{role}</small>
      </span>
    </div>
  );
}
