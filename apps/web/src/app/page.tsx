import { CalendarClock, Route, Timer } from "lucide-react";
import Link from "next/link";

import { HeroRoute } from "@/components/home/HeroRoute";
import { ModelModeNote } from "@/components/home/ModelModeNote";

const STEPS = [
  {
    title: "Choose a restaurant",
    body: "Browse by name or cuisine. Each restaurant's location is already saved, so there's nothing to look up.",
  },
  {
    title: "Set your delivery location",
    body: "Search for an address, tap the map, or use your current location. Drag the pin until it's at your door.",
  },
  {
    title: "Get your delivery time",
    body: "Review the route on the map, then see how long your order should take from kitchen to door.",
  },
];

const FACTORS = [
  {
    icon: Route,
    title: "The road distance to your door",
    body: "Your route is measured along actual streets, and that distance goes into the prediction.",
  },
  {
    icon: CalendarClock,
    title: "When and what you order",
    body: "The prediction model also looks at the hour, day, order type, festivals, and area type.",
  },
  {
    icon: Timer,
    title: "Drive time, shown for reference",
    body: "A drive estimate only covers the road. Your delivery time covers the whole order.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <h1 id="home-title" className="home-title">
            Know when your food will arrive
          </h1>
          <p className="home-lede">
            Pick a restaurant, drop a pin at your door, and get a delivery time based on the road
            distance and your order.
          </p>
          <div className="home-actions">
            <Link href="/restaurants" className="button button-primary button-lg">
              Predict delivery time
            </Link>
            <a href="#how-it-works" className="button button-secondary button-lg">
              See how it works
            </a>
          </div>
          <ModelModeNote />
        </div>
        <HeroRoute />
      </section>

      <section id="how-it-works" className="home-section" aria-labelledby="how-title">
        <div className="container how-grid">
          <h2 id="how-title" className="home-section-title">
            Three steps from craving to arrival time
          </h2>
          <ol className="how-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="how-step">
                <span className="how-step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-section factors" aria-labelledby="factors-title">
        <div className="container factors-grid">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="factors-photo"
            src="/images/restaurants/basil-chicken.jpg"
            alt="A bowl of stir-fried chicken with fresh basil"
            width={800}
            height={600}
            loading="lazy"
          />
          <div>
            <h2 id="factors-title" className="home-section-title">
              What shapes your estimate
            </h2>
            <ul className="factor-list">
              {FACTORS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="factor">
                  <Icon size={20} aria-hidden />
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
