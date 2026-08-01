"use client";

import NavLink from "./NavLink";
import { navigation } from "@/data/navigation";

interface Props {
  activeSection: string;
}

export default function DesktopNav({ activeSection }: Props) {
  return (
    <nav className="hidden items-center gap-8 lg:flex">
      {navigation.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          active={activeSection === item.href.replace("#", "")}
        />
      ))}
    </nav>
  );
}