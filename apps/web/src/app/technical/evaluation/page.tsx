import type { Metadata } from "next";

import { BarList } from "@/components/charts/BarList";
import { ChartFigure, DataTable } from "@/components/charts/ChartFigure";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { LineChart } from "@/components/charts/LineChart";
import { ServingStatus } from "@/components/technical/ServingStatus";
import {
  MODEL_COLORS,
  baselineModel,
  formatCount,
  formatFixed,
  formatSigned,
  modelReport,
  selectedModel,
} from "@/lib/report";
import type { ModelReportEntry } from "@/types/report";

export const metadata: Metadata = { title: "Evaluation" };

const METRICS = [
  { key: "mae", name: "MAE", unit: " min", format: "minutes", better: "lower", body: "Mean absolute error: on average, how many minutes the prediction is off." },
  { key: "rmse", name: "RMSE", unit: " min", format: "minutes", better: "lower", body: "Root mean squared error: like MAE, but big misses count for more." },
  { key: "r2", name: "R²", unit: "", format: "fixed3", better: "higher", body: "Share of the variation in delivery time the model explains. 0 is no better than the average, 1 is perfect." },
] as const;

type Bucket = { mae: number; bias: number };

export default function EvaluationPage() {
  const { models, evaluation, limits } = modelReport;
  const colorOf = (model: ModelReportEntry) => MODEL_COLORS[model.id] ?? "var(--series-1)";
  const histogramMax = Math.max(...evaluation.error_histogram.flatMap((row) => models.map((model) => row[model.id] ?? 0)));
  const zeroIndex = evaluation.error_histogram.findIndex((row) => row.from === 0);
  const minutes = evaluation.by_minute;
  const longest = evaluation.by_actual[evaluation.by_actual.length - 1];
  const longestBias = longest[selectedModel.id] as Bucket;
  const shortest = evaluation.by_actual[0];
  const shortestBias = shortest[selectedModel.id] as Bucket;
  const hours = limits.supported_order_hours;

  return (
    <>
      <header>
        <p className="tech-eyebrow">6. Evaluation</p>
        <h1 className="page-heading">How the models compare</h1>
        <p className="tech-lede">
          All three models were refitted on training and validation orders, then scored once on the{" "}
          {formatCount(evaluation.test_orders)} newest orders. {selectedModel.name} is about{" "}
          {baselineModel ? formatFixed(baselineModel.test.mae - selectedModel.test.mae, 1) : "a minute"} minutes per
          order better than predicting the median for everyone, and slightly better than a single Decision Tree.
        </p>
      </header>

      <section className="tech-section" aria-labelledby="metrics-title">
        <h2 id="metrics-title">The scores</h2>
        <ul className="bullets">
          {METRICS.map((metric) => (
            <li key={metric.key}>
              <strong>{metric.name}</strong>: {metric.body}
            </li>
          ))}
        </ul>
        <DataTable
          table={{
            columns: [
              { label: "Model" },
              { label: "Validation MAE", numeric: true },
              { label: "Validation RMSE", numeric: true },
              { label: "Validation R²", numeric: true },
              { label: "Test MAE", numeric: true },
              { label: "Test RMSE", numeric: true },
              { label: "Test R²", numeric: true },
              { label: "Mean signed error", numeric: true },
            ],
            rows: models.map((model) => [
              model.selected ? `${model.name} (selected)` : model.name,
              formatFixed(model.validation.mae),
              formatFixed(model.validation.rmse),
              formatFixed(model.validation.r2, 3),
              formatFixed(model.test.mae),
              formatFixed(model.test.rmse),
              formatFixed(model.test.r2, 3),
              `${formatSigned(model.test.mean_signed_error_minutes)} min`,
            ]),
          }}
        />
        <div className="figure-grid-3">
          {METRICS.map((metric) => (
            <ChartFigure key={metric.key} title={`Test ${metric.name}`} description={`${metric.better === "lower" ? "Lower" : "Higher"} is better.`}>
              <BarList
                format={metric.format}
                stacked
                max={metric.key === "r2" ? 1 : undefined}
                series={[{ id: "value", name: metric.name, color: "var(--series-1)" }]}
                rows={models.map((model) => ({
                  label: model.name,
                  color: colorOf(model),
                  emphasis: model.selected,
                  values: { value: metric.key === "r2" ? Math.max(0, model.test.r2) : model.test[metric.key] },
                }))}
              />
            </ChartFigure>
          ))}
        </div>
        <p>
          The baseline&apos;s R² is slightly below zero ({formatFixed(baselineModel?.test.r2 ?? 0, 3)}), drawn as zero above,
          because the median of older orders isn&apos;t quite the average of the test orders. Mean signed error is the
          average of predicted minus actual: {selectedModel.name}&apos;s{" "}
          {formatSigned(selectedModel.test.mean_signed_error_minutes)} min means it&apos;s almost unbiased overall.
        </p>
      </section>

      <ChartFigure
        title="Predicted against actual delivery time"
        description="For each actual delivery time, the average prediction of each model. The shaded band covers the middle 80% of the selected model's predictions. Points on the dashed line would be perfect."
        takeaway={`All three models pull toward the middle. ${selectedModel.name} overestimates short deliveries by about ${formatFixed(shortestBias.bias, 1)} min and underestimates the longest ones by about ${formatFixed(Math.abs(longestBias.bias), 1)} min. The inputs don't explain why one order takes 15 minutes and a similar one takes 45.`}
        legend={models.map((model) => ({ name: model.name, color: colorOf(model), shape: "line" }))}
        table={{
          columns: [
            { label: "Actual (min)", numeric: true },
            { label: "Orders", numeric: true },
            ...models.map((model) => ({ label: `${model.name} mean`, numeric: true })),
          ],
          rows: minutes.map((row) => [
            row.actual,
            row.orders,
            ...models.map((model) => formatFixed((row[model.id] as { mean: number }).mean, 1)),
          ]),
        }}
      >
        <LineChart
          ariaLabel="Average predicted delivery time for each actual delivery time, per model"
          series={models.map((model) => ({
            id: model.id,
            name: model.name,
            color: colorOf(model),
            points: minutes.map((row) => [row.actual, (row[model.id] as { mean: number }).mean] as [number, number]),
            band: model.selected
              ? minutes.map((row) => {
                  const value = row[model.id] as { p10: number; p90: number };
                  return [row.actual, value.p10, value.p90] as [number, number, number];
                })
              : undefined,
          }))}
          reference={{ from: [10, 10], to: [55, 55], label: "Perfect prediction" }}
          xDomain={[10, 55]}
          yDomain={[10, 55]}
          xLabel="Actual minutes"
          yLabel="Predicted minutes"
          unit="min"
          height={340}
        />
      </ChartFigure>

      <section className="tech-section" aria-labelledby="errors-title">
        <h2 id="errors-title">Prediction errors</h2>
        <p>
          Predicted minus actual minutes for every test order, in 2-minute bins. Left of zero is too early, right of zero is
          too late. All three charts share one scale.
        </p>
        <div className="figure-grid-3">
          {models.map((model) => (
            <ChartFigure
              key={model.id}
              title={model.name}
              tag={model.selected ? { label: "Selected" } : undefined}
              table={{
                columns: [{ label: "Error (min)" }, { label: "Orders", numeric: true }],
                rows: evaluation.error_histogram.map((row) => [`${row.from} to ${row.to}`, row[model.id] ?? 0]),
              }}
            >
              <ColumnChart
                ariaLabel={`Histogram of ${model.name} prediction errors`}
                data={evaluation.error_histogram.map((row) => ({
                  label: String(row.from),
                  values: { orders: row[model.id] ?? 0 },
                }))}
                series={[{ id: "orders", name: "Orders", color: colorOf(model) }]}
                yMax={histogramMax}
                labelEvery={5}
                unit="orders"
                xLabel="Error (min)"
                divider={zeroIndex >= 0 ? { index: zeroIndex, label: "0" } : undefined}
                height={220}
              />
            </ChartFigure>
          ))}
        </div>
      </section>

      <ChartFigure
        title="Error by actual delivery time"
        description="Average error, predicted minus actual, for test orders grouped by how long they really took. A negative error means the prediction was too early."
        takeaway={`The ${formatCount(longest.orders)} orders that took ${longest.label} are where the models struggle most: ${selectedModel.name} is about ${formatFixed(Math.abs(longestBias.bias), 0)} minutes too early on average.`}
        table={{
          columns: [
            { label: "Actual time" },
            { label: "Orders", numeric: true },
            ...models.map((model) => ({ label: `${model.name} MAE`, numeric: true })),
          ],
          rows: evaluation.by_actual.map((row) => [
            row.label,
            row.orders,
            ...models.map((model) => `${formatFixed((row[model.id] as Bucket).mae, 1)} min`),
          ]),
        }}
      >
        <DataTable
          table={{
            columns: [
              { label: "Actual time" },
              { label: "Orders", numeric: true },
              ...models.map((model) => ({ label: model.name, numeric: true })),
            ],
            rows: evaluation.by_actual.map((row) => [
              row.label,
              row.orders,
              ...models.map((model) => `${formatSigned((row[model.id] as Bucket).bias, 1)} min`),
            ]),
          }}
        />
      </ChartFigure>

      <section className="tech-section" aria-labelledby="limits-title">
        <h2 id="limits-title">Honest limits</h2>
        <ul className="bullets">
          <li>
            <strong>
              An R² of {formatFixed(selectedModel.test.r2, 2)} leaves most of the variation unexplained.
            </strong>{" "}
            Weather, traffic and how many orders the rider carries explain a lot of it, but they aren&apos;t known when
            the customer orders, so the model can&apos;t use them.
          </li>
          <li>
            <strong>Long deliveries are underestimated.</strong> A customer would rather be told 45 minutes and get the food
            in 35 than the reverse. A future version could predict a range or a high percentile instead of the average.
          </li>
          <li>
            <strong>The data is from 2022 and covers {formatCount(modelReport.split.rows_in_source)} orders in Indian cities.</strong>{" "}
            The demo&apos;s restaurants and map are in Bengaluru, which has orders in the dataset, but the model learned from
            every city together.
          </li>
          <li>
            <strong>Road distances are from today&apos;s map.</strong> OSRM routes use current OpenStreetMap roads, not the
            roads of 2022.
          </li>
        </ul>
      </section>

      <section className="tech-section" aria-labelledby="serving-title">
        <h2 id="serving-title">Where predictions are reliable</h2>
        <p>
          The training orders cover road distances from {formatFixed(limits.training_road_distance_km.min)} to{" "}
          {formatFixed(limits.training_road_distance_km.max)} km, ordered from 8 AM to midnight ({hours.length} distinct
          hours). The app warns outside those ranges, declines deliveries under{" "}
          {limits.blocked_road_distance_km.min} km or over {limits.blocked_road_distance_km.max} km by road, and treats a pin
          more than {limits.max_point_to_road_m} m from a road as having no route.
        </p>
        <h3 className="figure-title">What the running API serves now</h3>
        <ServingStatus />
      </section>
    </>
  );
}
