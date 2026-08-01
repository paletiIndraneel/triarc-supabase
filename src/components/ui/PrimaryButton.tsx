import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface PrimaryButtonProps {
  href: string;
  children: React.ReactNode;
}

export default function PrimaryButton({
  href,
  children,
}: PrimaryButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(16,185,129,0.25)] sm:px-7 sm:py-4 sm:text-base"
    >
      {children}
      <ArrowRight size={18} />
    </Link>
  );
}