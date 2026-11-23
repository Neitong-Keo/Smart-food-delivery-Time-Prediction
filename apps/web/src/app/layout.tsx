import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { DeliveryDraftProvider } from "@/hooks/use-delivery-draft";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Smart Delivery",
    template: "%s | Smart Delivery",
  },
  description:
    "Choose a restaurant, set your delivery location on the map, and get an estimated food delivery time.",
};

const themeInitScript = `
(() => {
  let saved;
  try {
    saved = window.localStorage.getItem("smart-delivery-theme");
  } catch {}
  document.documentElement.dataset.theme = saved === "dark" ? "dark" : "light";
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <DeliveryDraftProvider>
          <div className="page-shell">
            <SiteHeader />
            <main id="main-content" className="main-content" tabIndex={-1}>
              {children}
            </main>
            <SiteFooter />
          </div>
        </DeliveryDraftProvider>
      </body>
    </html>
  );
}
