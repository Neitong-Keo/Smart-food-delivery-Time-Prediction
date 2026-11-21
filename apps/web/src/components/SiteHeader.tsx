"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/predict", label: "Estimate" },
  { href: "/model", label: "Model Insights" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="site-header">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            SF
          </span>
          <div>
            <p className="brand-title">Smart Food Delivery Time Prediction</p>
            <p className="brand-subtitle">ETA Explorer &amp; Delivery Forecast</p>
          </div>
        </Link>

        <div className="header-controls">
          <nav className="nav-links" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

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

          <ThemeToggle />
        </div>
      </header>
    </>
  );
}

