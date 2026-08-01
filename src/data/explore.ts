export interface ExplorePlace {
  id: number;
  title: string;
  category: string;
  description: string;
  image: string;
  featured: boolean;
  mapsUrl: string;
  distanceKm?: number;
  driveMinutes?: number;
}

export const places: ExplorePlace[] = [
  {
    id: 1,
    title: "Sri Sita Ramachandra Swamy Temple",
    category: "Spiritual Heritage",
    description:
      "Experience one of India's most revered pilgrimage destinations, just minutes from TriArc EV Hub.",
    image: "/images/explore/temple.png",
    featured: true,
    mapsUrl: "https://maps.google.com/",
  },

  {
    id: 2,
    title: "Recharge Yourself",
    category: "Dining & Cafés",
    description:
      "From freshly brewed coffee to family restaurants, enjoy local flavours while your EV recharges.",
    image: "/images/explore/dining.png",
    featured: false,
    mapsUrl: "https://maps.google.com/",
  },

  {
    id: 3,
    title: "Godavari Riverfront",
    category: "Scenic Escape",
    description:
      "Unwind with peaceful riverside views before continuing your journey.",
    image: "/images/explore/explore.jpg",
    featured: false,
    mapsUrl: "https://maps.google.com/",
  },

  {
    id: 4,
    title: "Stay & Relax",
    category: "Comfort & Stay",
    description:
      "Comfortable hotels and essential amenities for overnight or extended stays.",
    image: "/images/explore/hotel.png",
    featured: false,
    mapsUrl: "https://maps.google.com/",
  },
];