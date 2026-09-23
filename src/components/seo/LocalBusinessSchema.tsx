import { site } from "@/data/site";
import { contact } from "@/data/contact";

const ORG_ID = `${site.url}/#organization`;
const BUSINESS_ID = `${site.url}/#localbusiness`;
const LOGO_URL = `${site.url}/logos/triarc.svg`;

/** Sitewide Organization + LocalBusiness JSON-LD, rendered once from the root layout. */
export default function LocalBusinessSchema() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: site.brand.fullName,
        alternateName: site.brand.name,
        url: `${site.url}/`,
        logo: LOGO_URL,
      },
      {
        "@type": "LocalBusiness",
        "@id": BUSINESS_ID,
        name: site.brand.fullName,
        image: LOGO_URL,
        url: `${site.url}/`,
        telephone: contact.phoneHref,
        priceRange: "$$",
        address: {
          "@type": "PostalAddress",
          streetAddress: contact.addressLine1,
          addressLocality: contact.city,
          addressRegion: contact.state,
          postalCode: contact.postalCode,
          addressCountry: contact.country,
        },
        areaServed: {
          "@type": "AdministrativeArea",
          name: "Telangana",
        },
        parentOrganization: { "@id": ORG_ID },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

/** Per-page BreadcrumbList JSON-LD. Pass absolute or root-relative URLs. */
export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${site.url}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
