import type { Metadata } from "next";

import { ApiStatus } from "@/components/ApiStatus";
import { RouteExplorer } from "@/features/onboarding/RouteExplorer";
import { Tour } from "@/features/onboarding/Tour";

export const metadata: Metadata = { title: "Route Explorer" };

export default function ExplorePage() {
  return (
    <div className="container page explore-stack">
      <section id="hero-section">
        <h1 className="page-heading">Route explorer</h1>
        <p className="page-intro">
          See how distance, traffic, and weather could change a delivery. These sample routes use
          illustrative numbers, not a trained model.
        </p>
        <div className="explore-actions">
          <Tour />
        </div>
      </section>
      <RouteExplorer />
      <ApiStatus />
    </div>
  );
}
