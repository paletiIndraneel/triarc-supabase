type DividerVariant = "soft" | "wave" | "slope" | "tight";
type DividerTone = "cyan" | "indigo" | "emerald" | "teal" | "blue";

interface SectionCurveDividerProps {
  className?: string;
  variant?: DividerVariant;
  tone?: DividerTone;
  heightClass?: string;
}

const variantPathMap: Record<DividerVariant, string> = {
  soft: "M0 24 C 280 98 1160 98 1440 24",
  wave: "M0 42 C 320 118 1120 2 1440 42",
  slope: "M0 84 C 420 18 1020 18 1440 84",
  tight: "M0 36 C 360 72 1080 72 1440 36",
};

const toneMap: Record<DividerTone, { line: string; glow: string }> = {
  cyan: { line: "rgba(45, 212, 255, 0.58)", glow: "rgba(45, 212, 255, 0.2)" },
  indigo: { line: "rgba(129, 140, 248, 0.52)", glow: "rgba(129, 140, 248, 0.18)" },
  emerald: { line: "rgba(52, 211, 153, 0.5)", glow: "rgba(52, 211, 153, 0.16)" },
  teal: { line: "rgba(45, 212, 191, 0.52)", glow: "rgba(45, 212, 191, 0.18)" },
  blue: { line: "rgba(56, 189, 248, 0.5)", glow: "rgba(56, 189, 248, 0.16)" },
};

export default function SectionCurveDivider({
  className = "",
  variant = "soft",
  tone = "cyan",
  heightClass = "h-16",
}: SectionCurveDividerProps) {
  const curvePath = variantPathMap[variant];
  const colors = toneMap[tone];

  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 ${heightClass} overflow-hidden ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="h-full w-full">
        <path d={curvePath} fill="none" stroke={colors.line} strokeWidth="2" />
        <path d={curvePath} fill="none" stroke={colors.glow} strokeWidth="6" />
      </svg>
    </div>
  );
}