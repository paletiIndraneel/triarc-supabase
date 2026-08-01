import Container from "../Container";
import HeroContent from "./HeroContent";
import HeroImage from "./HeroImage";

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.22),_transparent_34%),linear-gradient(135deg,_#03110d_0%,_#06231b_45%,_#04140f_100%)]"
    >
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle,_rgba(16,185,129,0.2),_transparent_70%)]" />
      <Container className="relative px-4 sm:px-6 lg:px-8 xl:px-12">
        <div
          className="mx-auto grid w-full max-w-[1440px] items-center gap-[clamp(24px,3vw,48px)] lg:grid-cols-[0.8fr_1.2fr]"
          style={{
            paddingTop: "clamp(56px, 6vw, 96px)",
            paddingBottom: "clamp(32px, 5vw, 72px)",
          }}
        >
          <HeroContent />
          <HeroImage />
        </div>
      </Container>
    </section>
  );
}