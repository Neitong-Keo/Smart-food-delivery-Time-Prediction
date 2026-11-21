import Link from "next/link";

export function ModelInsights() {
  return (
    <section className="callout callout-info" aria-labelledby="model-availability">
      <h2 id="model-availability" className="callout-title">
        Model evaluation results are not available yet
      </h2>
      <p className="callout-body">
        Model accuracy and feature importance will appear here when the backend publishes its evaluation results.
      </p>
      <div className="callout-actions">
        <Link href="/?tour=1" className="button button-primary">
          Take the illustrative tour
        </Link>
      </div>
    </section>
  );
}
