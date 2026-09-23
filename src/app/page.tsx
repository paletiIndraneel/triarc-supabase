import Hero from "@/components/Hero/Hero";
import ExperienceTriArc from "@/components/Experience/ExperienceTriArc";
import ChargingSolutions from "@/components/Charging/ChargingSolutions";
import StationHighlights from "@/components/Location/StationHighlights";
import ExploreNearby from "@/components/Explore/ExploreNearby";
import VisitUs from "@/components/Visit/VisitUs";
import Faq from "@/components/seo/Faq";
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
      "TRIARC EV Hub is located on Park Road, next to Kakatiya Residency, Bhadrachalam, Telangana 507111.",
  },
  {
    question: "Does TRIARC EV Hub offer DC fast charging?",
    answer:
      "Yes. TRIARC EV Hub offers DC fast charging in Bhadrachalam. Contact TRIARC for current station and charger information.",
  },
  {
    question: "Does TRIARC support businesses and fleets?",
    answer:
      "Yes. TRIARC EV Hub provides commercial EV charging, fleet charging and EV charger installation solutions for suitable business requirements.",
  },
];

export default function Home() {
  return (
    <>
      <main>
        <Hero />

        <ChargingSolutions />


        <ExploreNearby />

        <VisitUs />
      </main>

      <Footer />
    </>
  );
}