"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TECHNICAL_SECTIONS } from "@/lib/technical-sections";

const currentIndex = (pathname: string) =>
  TECHNICAL_SECTIONS.findIndex((section) => section.href === pathname.replace(/\/$/, ""));

/** The left sidebar: every section in reading order, with the current one marked. */
export function TechnicalNav() {
  const pathname = usePathname();
  const active = currentIndex(pathname);

  return (
    <nav className="tech-nav" aria-label="Technical report sections">
      <p className="tech-nav-title">Technical report</p>
      <ol>
        {TECHNICAL_SECTIONS.map((section, index) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className={`tech-nav-link ${index === active ? "tech-nav-link-active" : ""}`}
              aria-current={index === active ? "page" : undefined}
            >
              <span className="tech-nav-number" aria-hidden="true">
                {index}
              </span>
              {section.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Previous and next section links at the end of each page. */
export function TechnicalPager() {
  const pathname = usePathname();
  const active = currentIndex(pathname);
  if (active < 0) return null;
  const previous = TECHNICAL_SECTIONS[active - 1];
  const next = TECHNICAL_SECTIONS[active + 1];

  return (
    <nav className="tech-pager" aria-label="Previous and next sections">
      {previous ? (
        <Link href={previous.href} className="tech-pager-link">
          <span className="tech-pager-label">
            <ArrowLeft size={14} aria-hidden /> Previous
          </span>
          {previous.title}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="tech-pager-link tech-pager-next">
          <span className="tech-pager-label">
            Next <ArrowRight size={14} aria-hidden />
          </span>
          {next.title}
        </Link>
      )}
    </nav>
  );
}
