"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

import NavLink from "./NavLink";
import { navigation } from "@/data/navigation";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="lg:hidden text-white"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        {open ? <X size={26} /> : <Menu size={26} />}
      </button>

      {open && (
        <div className="absolute left-4 right-4 top-full mt-4 rounded-[24px] border border-white/10 bg-[#071A14]/95 p-6 backdrop-blur-xl lg:hidden">
          <div className="flex flex-col gap-5">
            {navigation.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                onClick={() => setOpen(false)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}