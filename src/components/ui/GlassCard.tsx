interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export default function GlassCard({
  children,
  className = "",
}: GlassCardProps) {
  return (
    <div
      className={`rounded-[28px] border border-white/10 bg-white/8 backdrop-blur-xl shadow-[0_20px_60px_rgba(2,12,8,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/30 ${className}`.trim()}
    >
      {children}
    </div>
  );
}