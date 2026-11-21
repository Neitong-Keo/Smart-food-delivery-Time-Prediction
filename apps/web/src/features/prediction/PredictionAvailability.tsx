import Link from "next/link";

export function PredictionAvailability() {
  return (
    <section className="callout callout-info" aria-labelledby="prediction-availability">
      <h2 id="prediction-availability" className="callout-title">
        Live predictions are not available yet
      </h2>
      <p className="callout-body">
        Try the sample route to see how distance, traffic, and weather can affect a delivery time.
      </p>
      <div className="callout-actions">
        <Link href="/?tour=1" className="button button-primary">
          Take the illustrative tour
        </Link>
      </div>
    </section>
  );
}
