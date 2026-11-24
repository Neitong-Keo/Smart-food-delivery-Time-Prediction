import Link from "next/link";

import { HeroRoute } from "@/components/home/HeroRoute";
import { ModelModeNote } from "@/components/home/ModelModeNote";

export default function HomePage() {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero-copy">
        <h1 id="home-title" className="home-title">
          Predict a food delivery time
        </h1>
        <p className="home-lede">
          Pick a Bengaluru restaurant, drop a pin, choose when you order, and compare what three
          machine learning models predict.
        </p>
        <div className="home-actions">
          <Link href="/restaurants" className="button button-primary button-lg">
            Start demo
          </Link>
          <Link href="/technical" className="button button-secondary button-lg">
            How the model works
          </Link>
        </div>
        <ModelModeNote />
      </div>
      <HeroRoute />
    </section>
  );
}
