import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Smart Food Delivery Time Prediction",
    template: "%s | Smart Food Delivery Time Prediction",
  },
  description:
    "Estimate food delivery times from distance, traffic, and weather conditions using Next.js and FastAPI.",
};

const themeInitScript = `
(() => {
  let saved;
  try {
    saved = window.localStorage.getItem("smart-delivery-theme");
  } catch {}
  document.documentElement.dataset.theme = saved === "dark" || saved === "light"
    ? saved
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="page-shell">
          <SiteHeader />
          <main id="main-content" className="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
