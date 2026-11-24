"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/layout/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

const DEMO_PATHS = ["/restaurants", "/delivery", "/predict", "/history"];

const NAV_ITEMS = [
  {
    href: "/restaurants",
    label: "Demo",
    isActive: (path: string) => path === "/" || DEMO_PATHS.some((prefix) => path.startsWith(prefix)),
  },
  {
    href: "/technical",
    label: "Technical",
    isActive: (path: string) => path.startsWith("/technical"),
  },
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
              const isActive = item.isActive(pathname);
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
          </div>
        </div>
      </header>
    </>
  );
}
