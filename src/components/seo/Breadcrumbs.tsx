import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import Container from "@/components/Container";
import { BreadcrumbSchema } from "./LocalBusinessSchema";

export interface Crumb {
  name: string;
  url: string;
}

/** Visible breadcrumb navigation paired with matching BreadcrumbList JSON-LD. */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail: Crumb[] = [{ name: "Home", url: "/" }, ...items];

  return (
    <div className="relative bg-[#03110d] pt-28 sm:pt-32">
      <Container>
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-white/50 sm:text-sm">
            {trail.map((crumb, index) => {
              const isLast = index === trail.length - 1;

              return (
                <li
                  key={`${crumb.url}-${index}`}
                  className="flex items-center gap-1.5"
                >
                  {index === 0 ? (
                    <Link
                      href={crumb.url}
                      aria-label="Home"
                      className="flex items-center gap-1 transition hover:text-emerald-300"
                    >
                      <Home size={14} aria-hidden="true" />
                    </Link>
                  ) : isLast ? (
                    <span
                      aria-current="page"
                      className="text-white/80"
                    >
                      {crumb.name}
                    </span>
                  ) : (
                    <Link
                      href={crumb.url}
                      className="transition hover:text-emerald-300"
                    >
                      {crumb.name}
                    </Link>
                  )}

                  {!isLast && (
                    <ChevronRight
                      size={14}
                      aria-hidden="true"
                      className="text-white/30"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </Container>

      <BreadcrumbSchema items={trail} />
    </div>
  );
}
