import type { Metadata } from "next";

import { BarList } from "@/components/charts/BarList";
import { BoxPlotChart } from "@/components/charts/BoxPlotChart";
import { ChartFigure, DataTable } from "@/components/charts/ChartFigure";
import { formatCount, formatFixed, outliers } from "@/lib/report";

export const metadata: Metadata = { title: "Outliers and cleaning" };

const BOX_NOTES: Record<string, string> = {
  delivery_time_minutes: `Orders past the right whisker are long but believable: ${Math.round(
    100 * outliers.long_delivery_festival_or_multi_share,
  )}% of them were during a festival or with a rider carrying several orders. They're kept, because removing them would teach the model that long deliveries never happen.`,
  road_distance_km: `On these routes the road is about ${formatFixed(outliers.road_detour_ratio.outliers, 1)} times the straight-line distance, against ${formatFixed(outliers.road_detour_ratio.all, 1)} times for a typical order, so the road network forces a detour. Orders over 40 km by road are left out of training, the same limit the app enforces.`,
  distance_km:
    "After clearing the impossible distances, straight-line distance has no outliers at all. Every remaining order is within about 21 km.",
};

export default function OutliersPage() {
  const cleaning = outliers.rules.filter((rule) => rule.stage === "cleaning");
  const modelRules = outliers.rules.filter((rule) => rule.stage === "model");
  const start = outliers.funnel[0].rows;

  return (
    <>
      <header>
        <p className="tech-eyebrow">3. Outliers and cleaning</p>
        <h1 className="page-heading">Outliers and cleaning</h1>
        <p className="tech-lede">
          Cleaning never silently drops an order. Each rule either fixes a value, clears one that can&apos;t be true, or
          flags the row for review. Rows only leave the training set at the end, when the model needs a value they
          don&apos;t have.
        </p>
      </header>

      <ChartFigure
        title="From the CSV to the training orders"
        description="How many orders remain after each step."
        takeaway={`${formatCount(outliers.funnel[outliers.funnel.length - 1].rows)} of ${formatCount(start)} orders (${formatFixed((100 * outliers.funnel[outliers.funnel.length - 1].rows) / start, 1)}%) reach the model. Cleaning itself removes none.`}
        table={{
          columns: [{ label: "Step" }, { label: "Orders", numeric: true }, { label: "Share", numeric: true }],
          rows: outliers.funnel.map((step) => [step.label, step.rows, `${formatFixed((100 * step.rows) / start, 1)}%`]),
        }}
      >
        <BarList
          format="count"
          max={start}
          labelWidth="12rem"
          series={[{ id: "rows", name: "Orders", color: "var(--series-1)" }]}
          rows={outliers.funnel.map((step) => ({ label: step.label, values: { rows: step.rows } }))}
        />
      </ChartFigure>

      <section className="tech-section" aria-labelledby="rules-title">
        <h2 id="rules-title">Cleaning rules</h2>
        <p>
          These run in <code>ml/preprocessing.py</code> on every row of the CSV. A rule with no matching rows is still
          checked, so a new version of the dataset can&apos;t slip through.
        </p>
        <DataTable
          table={{
            columns: [{ label: "Rule" }, { label: "Check" }, { label: "Rows", numeric: true }, { label: "What happens" }],
            rows: cleaning.map((rule) => [rule.title, rule.rule, rule.rows, rule.action]),
          }}
        />
      </section>

      <section className="tech-section" aria-labelledby="model-rules-title">
        <h2 id="model-rules-title">Rows left out of training</h2>
        <p>
          The training script, <code>ml/model_training.py</code>, needs a road distance inside the app&apos;s limits and
          an order time for the chronological split. Rows without them stay in the dataset but aren&apos;t used to train
          or test.
        </p>
        <DataTable
          table={{
            columns: [{ label: "Reason" }, { label: "Check" }, { label: "Rows", numeric: true }, { label: "What happens" }],
            rows: modelRules.map((rule) => [rule.title, rule.rule, rule.rows, rule.action]),
          }}
        />
      </section>

      <section className="tech-section" aria-labelledby="boxes-title">
        <h2 id="boxes-title">Outliers in the numbers</h2>
        <p>
          A value counts as an outlier here when it&apos;s more than 1.5 times the box width beyond the box. Dots show up to
          300 of them. Straight-line distances over 100 km, between{" "}
          {formatCount(outliers.max_straight_line_excluded_km.min)} and{" "}
          {formatCount(outliers.max_straight_line_excluded_km.max)} km, were cleared during cleaning and aren&apos;t shown.
        </p>
        {outliers.boxes.map((box) => (
          <ChartFigure
            key={box.column}
            title={box.label}
            description={`${formatCount(box.count)} orders. ${
              box.outliers
                ? `${formatCount(box.outliers)} outliers, ${box.outliers_above === box.outliers ? "all" : formatCount(box.outliers_above)} of them above the box.`
                : "No outliers."
            }`}
            takeaway={BOX_NOTES[box.column]}
            table={{
              columns: [
                { label: "Statistic" },
                { label: "Value", numeric: true },
              ],
              rows: [
                ["Minimum", box.min],
                ["Lower quartile", box.q1],
                ["Median", box.median],
                ["Upper quartile", box.q3],
                ["Maximum", box.max],
                ["Upper fence (1.5 × IQR)", box.high_fence],
                ["Outliers", box.outliers],
              ],
            }}
          >
            <BoxPlotChart
              ariaLabel={`Box plot of ${box.label.toLowerCase()}`}
              groups={[{ ...box, label: "All orders", outlierValues: box.outlier_values }]}
              xLabel={box.label}
              labelWidth={84}
            />
          </ChartFigure>
        ))}
      </section>
    </>
  );
}
