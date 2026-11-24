import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TechnicalNav, TechnicalPager } from "@/components/technical/TechnicalNav";

export const metadata: Metadata = {
  title: { default: "Technical report", template: "%s | Technical report" },
};

export default function TechnicalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container tech-layout">
      <aside className="tech-aside">
        <TechnicalNav />
      </aside>
      <div className="tech-main">
        <article className="tech-article">{children}</article>
        <TechnicalPager />
      </div>
    </div>
  );
}
