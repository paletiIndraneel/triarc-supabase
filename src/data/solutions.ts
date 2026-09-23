export interface Solution {
  slug: string;
  navLabel: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  summary: string;
  body: string[];
  highlights?: string[];
  cta: {
    label: string;
    href: string;
  };
}

export const solutions: Solution[] = [
  {
    slug: "ev-charging",
    navLabel: "EV Charging",
    metaTitle: "EV Charging in Bhadrachalam | TRIARC EV Hub",
    metaDescription:
      "Find EV charging at TRIARC EV Hub in Bhadrachalam, Telangana. Learn about the station and plan your visit.",
    title: "EV Charging in Bhadrachalam",
    summary:
      "Convenient EV charging for drivers visiting TRIARC EV Hub in Bhadrachalam.",
    body: [
      "TRIARC EV Hub provides EV charging for drivers visiting Bhadrachalam, Telangana. Whether you're stopping for a quick top-up or parking for a longer duration, the station is a convenient place to charge while you continue your journey.",
      "EV charging at TRIARC EV Hub supports multiple vehicle types, including electric cars and three-wheelers, with a comfortable space to wait while your vehicle charges.",
      "TRIARC EV Hub also works with businesses and fleet operators who are planning EV charging infrastructure of their own, drawing on its experience running a working EV charging station in Bhadrachalam.",
    ],
    cta: {
      label: "Find TRIARC EV Hub",
      href: "/ev-station/triarc-ev-hub-bhadrachalam",
    },
  },

  {
    slug: "dc-fast-charging",
    navLabel: "DC Fast Charging",
    metaTitle: "DC Fast Charging in Bhadrachalam | TRIARC EV Hub",
    metaDescription:
      "Explore DC fast charging information at TRIARC EV Hub in Bhadrachalam, Telangana.",
    title: "DC Fast Charging in Bhadrachalam",
    summary:
      "DC fast charging to help minimise waiting time on the road.",
    body: [
      "TRIARC EV Hub offers DC fast charging in Bhadrachalam for drivers who want to get back on the road with less waiting time than standard AC charging.",
      "DC fast charging at TRIARC EV Hub is part of the station's broader role in supporting EV charging infrastructure in Bhadrachalam and the wider Telangana region.",
      "Specific charger power ratings and connector types should be confirmed before being published as station specifications.",
    ],
    cta: {
      label: "Find TRIARC EV Hub",
      href: "/ev-station/triarc-ev-hub-bhadrachalam",
    },
  },

  {
    slug: "charger-installation",
    navLabel: "Charger Installation",
    metaTitle: "EV Charger Installation in Telangana | TRIARC EV Hub",
    metaDescription:
      "TRIARC EV Hub provides EV charger installation and charging infrastructure solutions for suitable residential, commercial and business requirements.",
    title: "EV Charger Installation",
    summary:
      "Plan and install EV charging infrastructure for suitable residential, commercial and other locations.",
    body: [
      "Looking to add EV charging at your property or business? TRIARC can help you evaluate charging requirements and plan an appropriate EV charging installation.",
      "Every property is different, so TRIARC works through the specifics of a site before recommending an approach to EV charger installation.",
    ],
    highlights: [
      "Site requirements",
      "Charging requirements",
      "Installation planning",
      "Commercial applications",
      "Fleet requirements",
    ],
    cta: {
      label: "Discuss Your Installation",
      href: "/contact",
    },
  },

  {
    slug: "commercial-ev-charging",
    navLabel: "Commercial EV Charging",
    metaTitle: "Commercial EV Charging Solutions | TRIARC EV Hub",
    metaDescription:
      "Plan EV charging infrastructure for businesses, workplaces and commercial locations with TRIARC EV Hub.",
    title: "Commercial EV Charging Solutions",
    summary:
      "Charging infrastructure solutions for businesses, customer facilities, workplaces and commercial operations.",
    body: [
      "TRIARC EV Hub supports commercial EV charging for businesses that rely on electric vehicles as part of daily operations, including workplaces, customer facilities and other commercial locations.",
      "TRIARC works with businesses in and around Bhadrachalam, Telangana to plan EV charging infrastructure suited to commercial use.",
    ],
    cta: {
      label: "Talk to TRIARC",
      href: "/contact",
    },
  },

  {
    slug: "fleet-charging",
    navLabel: "Fleet Charging",
    metaTitle: "Fleet EV Charging Solutions | TRIARC EV Hub",
    metaDescription:
      "Explore EV charging infrastructure solutions for commercial and electric vehicle fleets with TRIARC EV Hub.",
    title: "Fleet EV Charging Solutions",
    summary:
      "Charging infrastructure planned around the operational needs of electric fleets and commercial vehicles.",
    body: [
      "Organisations operating a fleet of electric vehicles need charging infrastructure that is reliable and easy to plan around. TRIARC EV Hub works with fleet operators travelling through or operating in and around Bhadrachalam, Telangana.",
      "Fleet EV charging solutions from TRIARC are planned around the operational needs of the vehicles involved, rather than a one-size-fits-all approach.",
    ],
    cta: {
      label: "Discuss Fleet Charging",
      href: "/contact",
    },
  },
];

export interface HubService {
  title: string;
  description: string;
  cta: string;
  href: string;
}

// Services displayed on the /charging-solutions hub page.
export const hubServices: HubService[] = [
  {
    title: "EV Charging",
    description:
      "Convenient EV charging for drivers visiting TRIARC EV Hub in Bhadrachalam.",
    cta: "Visit TRIARC EV Hub",
    href: "/ev-station/triarc-ev-hub-bhadrachalam",
  },

  {
    title: "EV Charger Installation",
    description:
      "Plan and install EV charging infrastructure for suitable residential, commercial and other locations.",
    cta: "Enquire About Installation",
    href: "/charging-solutions/charger-installation",
  },

  {
    title: "Commercial EV Charging",
    description:
      "Charging infrastructure solutions for businesses, customer facilities, workplaces and commercial operations.",
    cta: "Discuss Your Requirement",
    href: "/charging-solutions/commercial-ev-charging",
  },

  {
    title: "Fleet Charging",
    description:
      "Charging infrastructure planned around the operational needs of electric fleets and commercial vehicles.",
    cta: "Talk to TRIARC",
    href: "/charging-solutions/fleet-charging",
  },
];

export function getSolutionBySlug(slug: string) {
  return solutions.find((solution) => solution.slug === slug);
}