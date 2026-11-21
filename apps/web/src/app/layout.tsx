import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Food Delivery Time Prediction",
  description:
    "Phase 1 monorepo foundation with Next.js, FastAPI, and a backend-owned scikit-learn workflow scaffold.",
};

const themeInitScript = `
(() => {
  try {
    const saved = window.localStorage.getItem("smart-delivery-theme");
    const theme = saved === "dark" || saved === "light"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

