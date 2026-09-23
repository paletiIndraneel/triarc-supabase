import type { Metadata } from "next";
import Navbar from "@/components/Navbar/Navbar";
import LocalBusinessSchema from "@/components/seo/LocalBusinessSchema";
import { site } from "@/data/site";
import "./globals.css";

const SITE_URL = site.url;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TRIARC EV Hub | EV Charging Station in Bhadrachalam, Telangana",
    template: "%s | TRIARC EV Hub",
  },
  description:
    "TRIARC EV Hub is an EV charging station in Bhadrachalam, Telangana, offering EV charging and charging infrastructure solutions for vehicles, businesses and fleets.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: "TRIARC EV Hub | EV Charging Station in Bhadrachalam, Telangana",
    description:
      "EV charging and charging infrastructure solutions from TRIARC EV Hub in Bhadrachalam, Telangana.",
    url: SITE_URL,
    siteName: "TRIARC EV Hub",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/images/hero/hero.png",
        alt: "TRIARC EV Hub EV charging station in Bhadrachalam",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TRIARC EV Hub | EV Charging Station in Bhadrachalam, Telangana",
    description:
      "EV charging and charging infrastructure solutions from TRIARC EV Hub in Bhadrachalam, Telangana.",
    images: ["/images/hero/hero.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LocalBusinessSchema />
        <Navbar />
        {children}
      </body>
    </html>
  );
}