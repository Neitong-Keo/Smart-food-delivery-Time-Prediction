"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/layout/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/restaurants", label: "Restaurants", matches: ["/restaurants", "/delivery", "/predict"] },
  { href: "/history", label: "History", matches: ["/history"] },
  { href: "/model", label: "Model", matches: ["/model"] },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="container site-header-inner">
          <Link href="/" className="brand">
            <BrandMark />
            Smart Delivery
          </Link>

          <nav className="nav-links" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = item.matches.some((path) => pathname.startsWith(path));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${isActive ? "nav-link-active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="header-controls">
            <ThemeToggle />
            <Link href="/restaurants" className="button button-primary header-cta">
              Predict delivery time
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
