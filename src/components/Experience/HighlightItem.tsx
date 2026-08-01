import { LucideIcon } from "lucide-react";

interface HighlightItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function HighlightItem({
  icon: Icon,
  title,
  description,
}: HighlightItemProps) {
  return (
    <div className="group rounded-[24px] border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
        <Icon size={22} />
      </div>

      <h4 className="text-lg font-semibold text-white">
        {title}
      </h4>

      <p className="text-clamp-3 mt-3 leading-7 text-white/65">
        {description}
      </p>
    </div>
  );
}