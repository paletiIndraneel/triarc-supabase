interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared admin card surface. Keep this component neutral so CMS cards match
 * the Billing, Enquiries and CPO Settings design system.
 */
export default function GlassCard({
  children,
  className = "",
}: GlassCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`.trim()}
    >
      {children}
    </div>
  );
}
