import Hero from "@/components/Hero/Hero";
import ExperienceTriArc from "@/components/Experience/ExperienceTriArc";
import ChargingSolutions from "@/components/Charging/ChargingSolutions";
import StationHighlights from "@/components/Location/StationHighlights";
import ExploreNearby from "@/components/Explore/ExploreNearby";
import VisitUs from "@/components/Visit/VisitUs";
import Faq from "@/components/seo/Faq";
import SectionCurveDivider from "@/components/ui/SectionCurveDivider";
import Footer from "@/components/Footer/Footer";

const homeFaqItems = [
  {
    question: "What is TRIARC EV Hub?",
    answer:
      "TRIARC EV Hub is an EV charging station in Bhadrachalam, Telangana, offering EV charging and charging infrastructure solutions for vehicles, businesses and fleets.",
  },
  {
    question: "Where is TRIARC EV Hub located?",
    answer:
      "TRIARC EV Hub is located in Bhadrachalam, Telangana. See our Bhadrachalam location page for the full address and directions.",
  },
  {
    question: "Does TRIARC EV Hub offer DC fast charging?",
    answer:
      "Yes, TRIARC EV Hub offers DC fast charging alongside AC charging for electric cars and three-wheelers.",
  },
  {
    question: "Does TRIARC EV Hub support businesses and fleets?",
    answer:
      "Yes, TRIARC EV Hub provides commercial EV charging and fleet EV charging solutions, along with EV charger installation for businesses and property owners.",
  },
];

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <ExperienceTriArc />
        <div className="relative h-10">
          <SectionCurveDivider variant="soft" tone="emerald" heightClass="h-10" className="opacity-70" />
        </div>
        <ChargingSolutions />
        <StationHighlights />
        <div className="relative h-10">
          <SectionCurveDivider variant="soft" tone="emerald" heightClass="h-10" />
        </div>
        <ExploreNearby />
        <div className="relative h-8">
          <SectionCurveDivider variant="soft" tone="teal" heightClass="h-8" className="opacity-55" />
        </div>
        <VisitUs />
        <Faq items={homeFaqItems} />
      </main>

      <Footer />
    </>
  );
}