import Image from "next/image";

export default function HeroImage() {
  return (
    <div className="motion-reveal flex w-full items-center justify-center lg:justify-end">
      <div className="motion-float motion-glow w-full max-w-[980px] rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))] p-2 shadow-[0_30px_120px_rgba(2,12,8,0.45)] backdrop-blur-xl will-change-transform sm:p-3">
        <Image
          src="/images/hero/hero.png"
          alt="TriArc EV charging experience"
          width={1440}
          height={1600}
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 62vw, 980px"
          className="h-auto w-full rounded-[28px] object-contain"
        />
      </div>
    </div>
  );
}