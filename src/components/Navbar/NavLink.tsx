"use client";

interface NavLinkProps {
  href: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export default function NavLink({
  href,
  label,
  active = false,
  onClick,
}: NavLinkProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`
        relative
        px-2
        py-2
        text-sm
        font-medium
        transition-colors
        duration-300
        ${
          active
            ? "text-emerald-400"
            : "text-white/80 hover:text-white"
        }
      `}
    >
      {label}

      <span
        className={`
          absolute
          bottom-0
          left-0
          h-0.5
          rounded-full
          bg-emerald-400
          transition-all
          duration-300
          ${
            active ? "w-full" : "w-0 group-hover:w-full"
          }
        `}
      />
    </a>
  );
}