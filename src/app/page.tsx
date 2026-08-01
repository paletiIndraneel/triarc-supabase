import Hero from "@/components/Hero/Hero";
import ExperienceTriArc from "@/components/Experience/ExperienceTriArc";
import ChargingSolutions from "@/components/Charging/ChargingSolutions";
import ExploreNearby from "@/components/Explore/ExploreNearby";
import VisitUs from "@/components/Visit/VisitUs";
import SectionCurveDivider from "@/components/ui/SectionCurveDivider";
import Footer from "@/components/Footer/Footer";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <ExperienceTriArc />
        <div className="relative h-16">
          <SectionCurveDivider variant="soft" tone="emerald" heightClass="h-16" className="opacity-70" />
        </div>
        <ChargingSolutions />
        <div className="relative h-16">
          <SectionCurveDivider variant="soft" tone="emerald" heightClass="h-16" />
        </div>
        <ExploreNearby />
        <div className="relative h-10">
          <SectionCurveDivider variant="soft" tone="teal" heightClass="h-10" className="opacity-55" />
        </div>
        <VisitUs />
      </main>

      <Footer />
    </>
  );
}