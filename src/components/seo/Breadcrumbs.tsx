import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import Container from "@/components/Container";
import { BreadcrumbSchema } from "./LocalBusinessSchema";

export interface Crumb {
  name: string;
  url: string;
}

/** Visible breadcrumb nav paired with matching BreadcrumbList JSON-LD. */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail: Crumb[] = [{ name: "Home", url: "/" }, ...items];

  return (
    <div className="relative bg-[#03110d] pt-28 sm:pt-32">
      <Container>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-white/50 sm:text-sm">
          {trail.map((crumb, index) => {
            const isLast = index === trail.length - 1;
            return (
              <span key={crumb.url} className="flex items-center gap-1.5">
                {index === 0 ? (
                  <Link href={crumb.url} className="flex items-center gap-1 transition hover:text-emerald-300">
                    <Home size={14} />
                    <span className="sr-only">Home</span>
                  </Link>
                ) : isLast ? (
                  <span className="text-white/80">{crumb.name}</span>
                ) : (
                  <Link href={crumb.url} className="transition hover:text-emerald-300">
                    {crumb.name}
                  </Link>
                )}
                {!isLast && <ChevronRight size={14} className="text-white/30" />}
              </span>
            );
          })}
        </nav>
      </Container>
      <BreadcrumbSchema items={trail} />
    </div>
  );
}
