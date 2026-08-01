import Link from "next/link";

interface SecondaryButtonProps {
  href: string;
  children: React.ReactNode;
}

export default function SecondaryButton({
  href,
  children,
}: SecondaryButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/85 transition-all duration-300 hover:border-emerald-400/40 hover:bg-white/10 hover:text-emerald-200 sm:px-7 sm:py-4 sm:text-base"
    >
      {children}
    </Link>
  );
}