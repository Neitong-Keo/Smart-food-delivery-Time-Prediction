import { existsSync } from "node:fs";
import path from "node:path";

import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { BarList } from "@/components/charts/BarList";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { SlideDeck } from "@/components/technical/SlideDeck";
import {
  MODEL_COLORS,
  PARTITION_COLORS,
  baselineModel,
  eda,
  formatCount,
  formatFixed,
  formatParameters,
  modelReport,
  outliers,
  selectedModel,
} from "@/lib/report";

export const metadata: Metadata = { title: "Slides" };

/** Drop an exported deck here to show it next to the built-in slides. */
const PDF_PATH = "/slides/presentation.pdf";

function Slide({ kicker, title, children, titlePage = false }: {
  kicker?: string;
  title: string;
  children?: ReactNode;
  titlePage?: boolean;
}) {
  return (
    <section className={`slide ${titlePage ? "slide-title-page" : ""}`}>
      {kicker && <p className="slide-kicker">{kicker}</p>}
      <h2>{title}</h2>
      {children && <div className="slide-body">{children}</div>}
    </section>
  );
}

export default function SlidesPage() {
  const hasPdf = existsSync(path.join(process.cwd(), "public", PDF_PATH));
  const used = modelReport.split.partitions.reduce((sum, partition) => sum + partition.rows, 0);
  const festival = eda.by_category.find((category) => category.column === "Festival")?.groups;
  const traffic = eda.by_category.find((category) => category.column === "Road_traffic_density")?.groups;
  const longest = modelReport.evaluation.by_actual[modelReport.evaluation.by_actual.length - 1];
  const longestBias = longest[selectedModel.id] as { bias: number };
  const tuned = modelReport.models.filter((model) => model.trials.length);

  const slides: { title: string; body: ReactNode }[] = [
    {
      title: "Title",
      body: (
        <Slide kicker="Smart Food Delivery Time Prediction" title="Predicting how long a food delivery takes" titlePage>
          <p>
            A machine learning model that estimates delivery minutes from what&apos;s known when the customer orders,
            served in a live demo app.
          </p>
        </Slide>
      ),
    },
    {
      title: "The problem",
      body: (
        <Slide kicker="The problem" title="When will my food arrive?">
          <ul>
            <li>Predict the minutes from placing an order to receiving it.</li>
            <li>Use only what the app knows at that moment: where, when and what is ordered.</li>
            <li>Weather, traffic and the rider are unknown when the customer presses order.</li>
          </ul>
        </Slide>
      ),
    },
    {
      title: "The data",
      body: (
        <Slide kicker="The data" title={`${formatCount(eda.rows)} Zomato orders`}>
          <div className="slide-columns">
            <ul>
              <li>
                {eda.cities} Indian cities, {eda.first_order} to {eda.last_order}
              </li>
              <li>{eda.columns} columns per order</li>
              <li>
                Delivery time: {eda.target.min} to {eda.target.max} min, median {eda.target.median}
              </li>
            </ul>
            <ColumnChart
              ariaLabel="Histogram of delivery time"
              data={eda.target_histogram.map((row) => ({ label: String(row.minutes), values: { orders: row.orders } }))}
              series={[{ id: "orders", name: "Orders", color: "var(--series-1)" }]}
              unit="orders"
              labelEvery={10}
              height={200}
              xLabel="Delivery time (min)"
            />
          </div>
        </Slide>
      ),
    },
    {
      title: "What drives delivery time",
      body: (
        <Slide kicker="Exploratory analysis" title="What drives delivery time">
          <div className="slide-columns">
            <div>
              <p>
                <strong>Known at order time</strong>
              </p>
              <ul>
                <li>Hour: about 20 min in the morning, 31 min from 7 to 9 PM</li>
                <li>
                  Festival: {formatFixed(festival?.find((g) => g.value === "yes")?.mean ?? 0, 0)} min against{" "}
                  {formatFixed(festival?.find((g) => g.value === "no")?.mean ?? 0, 0)}
                </li>
                <li>Road distance: correlation {formatFixed(eda.distance.pearson)}</li>
              </ul>
            </div>
            <div>
              <p>
                <strong>Not known, so not used</strong>
              </p>
              <ul>
                <li>
                  Traffic jam: {formatFixed(traffic?.find((g) => g.value === "jam")?.mean ?? 0, 0)} min against{" "}
                  {formatFixed(traffic?.find((g) => g.value === "low")?.mean ?? 0, 0)} in low traffic
                </li>
                <li>Weather, rider rating and age</li>
                <li>Orders the rider carries at once</li>
              </ul>
            </div>
          </div>
        </Slide>
      ),
    },
    {
      title: "Cleaning",
      body: (
        <Slide kicker="Outliers and cleaning" title="Clean, flag, never silently drop">
          <BarList
            format="count"
            max={outliers.funnel[0].rows}
            labelWidth="13rem"
            series={[{ id: "rows", name: "Orders", color: "var(--series-1)" }]}
            rows={outliers.funnel.map((step) => ({ label: step.label, values: { rows: step.rows } }))}
          />
        </Slide>
      ),
    },
    {
      title: "Road distance",
      body: (
        <Slide kicker="Features" title="Six inputs, all known at order time">
          <ul>
            {modelReport.features.map((feature) => (
              <li key={feature.column}>
                <strong>{feature.label}</strong>: {feature.source.toLowerCase()}
              </li>
            ))}
          </ul>
          <p>Road distance comes from the same OSRM route in training and in the app, never a straight line.</p>
        </Slide>
      ),
    },
    {
      title: "Chronological split",
      body: (
        <Slide kicker="Data split" title="Train on the past, test on the future">
          <BarList
            format="count"
            max={used}
            labelWidth="13rem"
            series={[{ id: "rows", name: "Orders", color: "var(--series-1)" }]}
            rows={modelReport.split.partitions.map((partition) => ({
              label: partition.name,
              note: `${partition.first} to ${partition.last}`,
              color: PARTITION_COLORS[partition.name.toLowerCase() as keyof typeof PARTITION_COLORS],
              values: { rows: partition.rows },
            }))}
          />
          <p>A random split would let the model see orders from the same evenings it&apos;s tested on.</p>
        </Slide>
      ),
    },
    {
      title: "Models",
      body: (
        <Slide kicker="Training" title="Three models, one pipeline">
          <ul>
            <li>
              <strong>Median baseline</strong>: the training median for every order
              {baselineModel ? `, ${formatFixed(baselineModel.test.mae)} min test MAE` : ""}. Any useful model must beat
              it.
            </li>
            {tuned.map((model) => (
              <li key={model.id}>
                <strong>{model.name}</strong>: {model.trials.length} settings tried, best{" "}
                {formatParameters(model.parameters)}
              </li>
            ))}
            <li>Median fill for numbers, one-hot encoding for categories, chosen on validation MAE.</li>
          </ul>
        </Slide>
      ),
    },
    {
      title: "Results",
      body: (
        <Slide kicker="Evaluation" title={`${selectedModel.name}: ${formatFixed(selectedModel.test.mae)} minutes off on average`}>
          <BarList
            format="minutes"
            labelWidth="10rem"
            series={[{ id: "mae", name: "Test MAE", color: "var(--series-1)" }]}
            rows={modelReport.models.map((model) => ({
              label: model.name,
              color: MODEL_COLORS[model.id],
              emphasis: model.selected,
              values: { mae: model.test.mae },
            }))}
          />
          <p>
            Test MAE on {formatCount(modelReport.evaluation.test_orders)} newer orders. R²{" "}
            {formatFixed(selectedModel.test.r2, 2)}, mean signed error{" "}
            {formatFixed(selectedModel.test.mean_signed_error_minutes)} min.
          </p>
        </Slide>
      ),
    },
    {
      title: "Limits",
      body: (
        <Slide kicker="Honest limits" title="What the model can't see">
          <ul>
            <li>
              R² of {formatFixed(selectedModel.test.r2, 2)}: most variation comes from things unknown at order time.
            </li>
            <li>
              Orders that took {longest.label} are predicted about {formatFixed(Math.abs(longestBias.bias), 0)} minutes
              too early.
            </li>
            <li>2022 data from many Indian cities; the demo map is limited to Bengaluru.</li>
          </ul>
        </Slide>
      ),
    },
    {
      title: "Demo",
      body: (
        <Slide kicker="Live demo" title="Try it" titlePage>
          <p>Pick a restaurant, drop a pin, choose an order time and compare the three models.</p>
          <p>
            <Link href="/restaurants" className="button button-primary button-lg">
              Start the demo
            </Link>
          </p>
        </Slide>
      ),
    },
  ];

  return (
    <>
      <header>
        <p className="tech-eyebrow">7. Slides</p>
        <h1 className="page-heading">Presentation</h1>
        <p className="tech-lede">
          The talk, built from the same numbers as this report. Use the arrow keys to move between slides, and present
          full screen from the button below the slide.
        </p>
      </header>

      <SlideDeck
        slides={slides.map((slide) => (
          <Fragment key={slide.title}>{slide.body}</Fragment>
        ))}
        titles={slides.map((slide) => slide.title)}
      />

      <section className="tech-section" aria-labelledby="pdf-title">
        <h2 id="pdf-title">Exported deck</h2>
        {hasPdf ? (
          <>
            <iframe className="slides-pdf" src={PDF_PATH} title="Presentation slides (PDF)" />
            <p>
              <a className="button button-secondary" href={PDF_PATH} download>
                <Download size={16} aria-hidden />
                Download the PDF
              </a>
            </p>
          </>
        ) : (
          <p>
            To show the team&apos;s exported slides here as well, save them as{" "}
            <code>apps/web/public{PDF_PATH}</code> and rebuild. The page embeds the PDF and adds a download link.
          </p>
        )}
      </section>
    </>
  );
}
