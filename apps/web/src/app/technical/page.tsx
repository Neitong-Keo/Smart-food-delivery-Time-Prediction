import type { Metadata } from "next";
import Link from "next/link";

import { baselineModel, eda, formatCount, formatFixed, modelReport, selectedModel } from "@/lib/report";
import { TECHNICAL_SECTIONS } from "@/lib/technical-sections";

export const metadata: Metadata = { title: "Technical report" };

const FLOW = [
  { title: "Raw CSV", body: `${formatCount(eda.rows)} Zomato orders, ${eda.columns} columns` },
  { title: "Clean", body: "Fix labels, parse times, clear impossible values" },
  { title: "Add road distance", body: "OSRM route for each restaurant and customer" },
  { title: "Split by time", body: "Older orders train, newer orders test" },
  { title: "Train and tune", body: "Median baseline, Decision Tree, XGBoost" },
  { title: "Serve", body: "FastAPI loads all three for the demo" },
];

export default function TechnicalOverviewPage() {
  const used = modelReport.split.partitions.reduce((sum, partition) => sum + partition.rows, 0);
  const improvement = baselineModel ? baselineModel.test.mae - selectedModel.test.mae : null;

  return (
    <>
      <header>
        <p className="tech-eyebrow">Technical report</p>
        <h1 className="page-heading">How the delivery time model works</h1>
        <p className="tech-lede">
          The model predicts how many minutes a food order takes from the moment it&apos;s placed to the
          moment it arrives. It only uses what&apos;s known when the customer orders: the road distance,
          the time and day, the order type, the city type and whether it&apos;s a festival.
        </p>
      </header>

      <dl className="stat-grid">
        <div className="stat">
          <dt>Orders in the dataset</dt>
          <dd>{formatCount(eda.rows)}</dd>
          <dd className="stat-note">
            {eda.first_order} to {eda.last_order}
          </dd>
        </div>
        <div className="stat">
          <dt>Orders used for the model</dt>
          <dd>{formatCount(used)}</dd>
          <dd className="stat-note">With a road distance and an order time</dd>
        </div>
        <div className="stat">
          <dt>Model inputs</dt>
          <dd>{modelReport.features.length}</dd>
          <dd className="stat-note">All known at order time</dd>
        </div>
        <div className="stat">
          <dt>{selectedModel.name} test error</dt>
          <dd>{formatFixed(selectedModel.test.mae)} min</dd>
          <dd className="stat-note">
            {improvement !== null ? `${formatFixed(improvement)} min better than the baseline` : "Mean absolute error"}
          </dd>
        </div>
      </dl>

      <section className="tech-section" aria-labelledby="approach-title">
        <h2 id="approach-title">The approach</h2>
        <ol className="flow">
          {FLOW.map((step, index) => (
            <li key={step.title} className={`flow-step ${index === 4 ? "flow-step-accent" : ""}`}>
              <strong>
                {index + 1}. {step.title}
              </strong>
              <span>{step.body}</span>
            </li>
          ))}
        </ol>
        <p>
          Three models are trained on the same orders and compared on the same newer orders. The{" "}
          <strong>median baseline</strong> predicts the same time for every order, so any useful model has
          to beat it. <strong>{selectedModel.name}</strong> had the lowest validation error, so the app uses
          it by default. The demo shows all three side by side.
        </p>
      </section>

      <section className="tech-section" aria-labelledby="sections-title">
        <h2 id="sections-title">Sections</h2>
        <ol className="toc">
          {TECHNICAL_SECTIONS.slice(1).map((section, index) => (
            <li key={section.href}>
              <Link href={section.href}>
                <span className="toc-number">{index + 1}</span>
                <span className="toc-title">{section.title}</span>
                <span className="toc-summary">{section.summary}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
