import type { Metadata } from "next";
import Navbar from "@/components/Navbar/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TriArc EV Charging",
    template: "%s | TriArc EV Charging",
  },
  description: "Premium EV charging in Bhadrachalam with fast AC and DC charging, a premium customer experience, and seamless access.",
  keywords: ["EV charging", "Bhadrachalam", "electric vehicle", "fast charging", "TriArc"],
  openGraph: {
    title: "TriArc EV Charging",
    description: "Premium EV charging in Bhadrachalam with fast AC and DC charging.",
    type: "website",
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
        <Navbar />
        {children}
      </body>
    </html>
  );
}