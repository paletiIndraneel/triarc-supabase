import type { Metadata } from "next";
import "./globals.css";

const noIndex = { index: false, follow: false, noarchive: true, nosnippet: true, noimageindex: true, notranslate: true, nocache: true };

export const metadata: Metadata = {
  title: { default: "TRIARC GROUP | Admin", template: "TRIARC GROUP | %s" },
  description: "Triarc Group admin.",
  robots: { ...noIndex, googleBot: noIndex },
  // Ask AI services not to use the page either.
  other: { "noai": "noai", "noimageai": "noimageai" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
