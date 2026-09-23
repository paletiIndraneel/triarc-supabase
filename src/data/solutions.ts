export interface Solution {
  slug: string;
  navLabel: string;
  metaTitle: string;
  title: string;
  description: string;
  summary: string;
  body: string[];
}

export const solutions: Solution[] = [
  {
    slug: "ev-charging",
    navLabel: "EV Charging",
    metaTitle: "EV Charging Solutions | TRIARC EV Hub",
    title: "EV Charging Solutions",
    description:
      "TRIARC EV Hub provides EV charging solutions in Bhadrachalam, Telangana, with dependable AC and DC charging for daily driving, longer trips and everything in between.",
    summary: "Reliable AC and DC EV charging for everyday driving and longer journeys.",
    body: [
      "TRIARC EV Hub offers EV charging built around convenience, safety and reliability. Whether you're stopping for a quick top-up or parking for a longer duration, our charging station in Bhadrachalam is designed to keep your electric vehicle ready for the road ahead.",
      "Our EV charging infrastructure supports multiple vehicle types, including electric cars and three-wheelers, with well-lit charging bays and a comfortable space to wait while your vehicle charges.",
      "As part of the wider TRIARC EV Hub charging infrastructure in Telangana, our EV charging solutions are built to grow with the needs of everyday drivers as well as businesses and fleets operating in and around Bhadrachalam.",
    ],
  },
  {
    slug: "dc-fast-charging",
    navLabel: "DC Fast Charging",
    metaTitle: "DC Fast Charging Solutions | TRIARC EV Hub",
    title: "DC Fast Charging Solutions",
    description:
      "DC fast charging from TRIARC EV Hub in Bhadrachalam, Telangana helps drivers recharge quickly and continue their journey with minimal waiting time.",
    summary: "High-speed DC fast charging to minimise waiting time on the road.",
    body: [
      "For drivers who need to get back on the road quickly, TRIARC EV Hub provides DC fast charging in Bhadrachalam. DC fast charging is ideal for highway travellers and anyone looking to top up their electric vehicle in a shorter amount of time compared to standard AC charging.",
      "Our DC fast charging station is part of TRIARC EV Hub's broader EV charging infrastructure in Telangana, supporting the growing number of electric vehicles on regional routes through Bhadrachalam.",
      "TODO: Publish verified charger power ratings, connector types and charging speed once confirmed for the Bhadrachalam station.",
    ],
  },
  {
    slug: "charger-installation",
    navLabel: "Charger Installation",
    metaTitle: "EV Charger Installation & Infrastructure | TRIARC EV Hub",
    title: "EV Charger Installation & Charging Infrastructure",
    description:
      "TRIARC provides EV charger installation and EV charging infrastructure solutions, helping businesses and property owners bring reliable charging online.",
    summary: "EV charger installation and infrastructure planning for businesses and properties.",
    body: [
      "Beyond operating our own EV charging station in Bhadrachalam, TRIARC provides EV charger installation and EV charging infrastructure solutions for businesses and property owners who want to offer charging on-site.",
      "Our approach to charging infrastructure installation focuses on reliability and long-term serviceability, drawing on our experience running an operating EV charging station in Telangana.",
      "If you are exploring EV charging infrastructure for a business, workplace or commercial property, TRIARC EV Hub can help you understand what is involved in bringing an EV charger installation online.",
    ],
  },
  {
    slug: "commercial-charging",
    navLabel: "Commercial Charging",
    metaTitle: "Commercial EV Charging Solutions | TRIARC EV Hub",
    title: "Commercial EV Charging Solutions",
    description:
      "TRIARC EV Hub delivers commercial EV charging solutions for businesses operating electric vehicles in and around Bhadrachalam, Telangana.",
    summary: "Commercial EV charging infrastructure for businesses and commercial vehicles.",
    body: [
      "TRIARC EV Hub supports commercial EV charging for businesses that rely on electric vehicles as part of daily operations, including electric three-wheelers and other commercial vehicle types.",
      "Our commercial EV charging infrastructure is designed for dependable, repeat use, helping local businesses in Bhadrachalam and the wider Telangana region keep commercial vehicles charged and on schedule.",
      "TRIARC EV Hub can be a charging point for businesses looking for a dependable commercial EV charging option in the region.",
    ],
  },
  {
    slug: "fleet-charging",
    navLabel: "Fleet Charging",
    metaTitle: "Fleet EV Charging Solutions | TRIARC EV Hub",
    title: "Fleet EV Charging Solutions",
    description:
      "TRIARC EV Hub offers fleet EV charging solutions for organisations managing multiple electric vehicles in and around Bhadrachalam, Telangana.",
    summary: "Fleet EV charging infrastructure for organisations managing multiple vehicles.",
    body: [
      "Organisations operating a fleet of electric vehicles need charging infrastructure that is reliable and easy to plan around. TRIARC EV Hub provides fleet EV charging support for fleets travelling through or operating in Bhadrachalam.",
      "Our fleet EV charging infrastructure is built on the same reliable AC and DC charging used at our public EV charging station, giving fleet operators a dependable option in the Telangana region.",
      "If your organisation is evaluating fleet EV charging in or around Bhadrachalam, TRIARC EV Hub is glad to discuss your requirements.",
    ],
  },
];

export function getSolutionBySlug(slug: string) {
  return solutions.find((solution) => solution.slug === slug);
}
