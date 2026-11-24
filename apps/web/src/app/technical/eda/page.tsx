import type { Metadata } from "next";

import { BarList } from "@/components/charts/BarList";
import { BoxPlotChart } from "@/components/charts/BoxPlotChart";
import { ChartFigure } from "@/components/charts/ChartFigure";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { LineChart } from "@/components/charts/LineChart";
import { eda, formatCount, formatFixed } from "@/lib/report";

export const metadata: Metadata = { title: "Exploratory analysis" };

const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
const MODEL_INPUT = { label: "Model input" } as const;
const NOT_USED = { label: "Not used", tone: "muted" } as const;
const CATEGORY_NOTES: Record<string, string> = {
  Type_of_order: "All four order types take about the same time, so the model gets little from this input.",
  Festival: "Festival orders take much longer, about 45 minutes against 26. Few orders are festivals, but the effect is large.",
  City: "Semi-urban orders take far longer. Metropolitan orders take a few minutes longer than urban ones.",
  Weather_conditions: "Sunny days are fastest. Weather is recorded during the delivery, so the app can't know it when you order.",
  Road_traffic_density: "Traffic jams add about 10 minutes. Traffic is also recorded during the delivery, so it isn't a model input.",
  multiple_deliveries: "Riders carrying 2 or 3 orders are much slower. This depends on rider assignment after the order.",
};

export default function EdaPage() {
  const { target } = eda;
  // Midnight orders are the day's last hour in this dataset, so show them after 11 PM.
  const hours = [...eda.by_hour].sort((a, b) => ((a.hour + 16) % 24) - ((b.hour + 16) % 24));
  const categories = eda.by_category.filter((category) => category.column in CATEGORY_NOTES);
  const missing = eda.missing.filter((row) => (row.raw_missing ?? 0) > 0 || (row.missing_after_cleaning ?? 0) > 0);
  const points = eda.distance.points.filter(([x]) => x <= 40);
  const bins = eda.distance.bins.filter((bin) => bin.to <= 40);

  return (
    <>
      <header>
        <p className="tech-eyebrow">2. Exploratory analysis</p>
        <h1 className="page-heading">What drives delivery time</h1>
        <p className="tech-lede">
          Before training, we looked at how delivery time varies with each column. The question for each one: does it
          change delivery time, and is it known at the moment the customer orders?
        </p>
      </header>

      <div className="callout">
        <p className="callout-title">Only order-time information can be a model input</p>
        <p>
          Weather, traffic, the rider&apos;s age, rating and vehicle, and how many orders the rider carries are all in the
          dataset, and several of them matter. But they&apos;re recorded during the delivery or depend on which rider
          takes the order, so the app can&apos;t know them when the customer orders. Training on them would make the test
          scores look better than the app could ever be. They&apos;re marked <strong>Not used</strong> below.
        </p>
      </div>

      <ChartFigure
        title="Delivery time"
        tag={{ label: "Target" }}
        description={`How long each of the ${formatCount(target.count)} orders took, in whole minutes.`}
        takeaway={`Most orders take ${target.q1} to ${target.q3} minutes. The median is ${target.median} minutes and the mean ${formatFixed(target.mean, 1)}. Times range from ${target.min} to ${target.max} minutes with a long right tail.`}
        table={{
          columns: [{ label: "Minutes", numeric: true }, { label: "Orders", numeric: true }],
          rows: eda.target_histogram.map((row) => [row.minutes, row.orders]),
        }}
      >
        <ColumnChart
          ariaLabel="Histogram of delivery time in minutes"
          data={eda.target_histogram.map((row) => ({ label: String(row.minutes), values: { orders: row.orders } }))}
          series={[{ id: "orders", name: "Orders", color: "var(--series-1)" }]}
          xLabel="Delivery time (min)"
          yLabel="Orders"
          unit="orders"
          labelEvery={5}
        />
      </ChartFigure>

      <div className="figure-grid">
        <ChartFigure
          title="By hour of the order"
          tag={MODEL_INPUT}
          description="Average delivery time for orders placed in each hour. No orders were placed between 1 AM and 8 AM."
          takeaway="The hour matters a lot: about 20 minutes for orders from 8 to 10 AM, about 31 minutes from 7 to 9 PM, and about 23 minutes late at night. Shuffling this input hurts the model more than any other."
          table={{
            columns: [{ label: "Hour" }, { label: "Orders", numeric: true }, { label: "Mean (min)", numeric: true }],
            rows: hours.map((row) => [hourLabel(row.hour), row.orders, formatFixed(row.mean, 1)]),
          }}
        >
          <ColumnChart
            ariaLabel="Average delivery time by hour"
            data={hours.map((row) => ({ label: hourLabel(row.hour).replace(" ", ""), values: { mean: row.mean } }))}
            series={[{ id: "mean", name: "Average delivery time", color: "var(--series-1)" }]}
            yLabel="Average minutes"
            unit="min"
            digits={1}
            labelEvery={3}
          />
        </ChartFigure>

        <ChartFigure
          title="By day of the week"
          tag={MODEL_INPUT}
          description="Average delivery time for orders placed on each day."
          takeaway="Every day averages between 25 and 28 minutes. The day matters much less than the hour."
          table={{
            columns: [{ label: "Day" }, { label: "Orders", numeric: true }, { label: "Mean (min)", numeric: true }],
            rows: eda.by_day.map((row) => [row.label, row.orders, formatFixed(row.mean, 1)]),
          }}
        >
          <ColumnChart
            ariaLabel="Average delivery time by day of the week"
            data={eda.by_day.map((row) => ({ label: row.label.slice(0, 3), values: { mean: row.mean } }))}
            series={[{ id: "mean", name: "Average delivery time", color: "var(--series-1)" }]}
            yLabel="Average minutes"
            unit="min"
            digits={1}
          />
        </ChartFigure>
      </div>

      <section className="tech-section" aria-labelledby="categories-title">
        <h2 id="categories-title">Delivery time by category</h2>
        <p>
          Each box covers the middle half of orders, the line inside is the median, and the whiskers reach the furthest
          order within 1.5 times the box&apos;s width. Hover a row for the numbers.
        </p>
        <div className="figure-grid">
          {categories.map((category) => (
            <ChartFigure
              key={category.column}
              title={category.label}
              tag={category.model_input ? MODEL_INPUT : NOT_USED}
              takeaway={CATEGORY_NOTES[category.column]}
              table={{
                columns: [
                  { label: "Value" },
                  { label: "Orders", numeric: true },
                  { label: "Median", numeric: true },
                  { label: "Mean", numeric: true },
                ],
                rows: category.groups.map((group) => [group.value, group.count, group.median, formatFixed(group.mean, 1)]),
              }}
            >
              <BoxPlotChart
                ariaLabel={`Delivery time by ${category.label.toLowerCase()}`}
                groups={category.groups.map((group) => ({ ...group, label: group.value }))}
                color={category.model_input ? "var(--series-1)" : "var(--color-text-subtle)"}
                domain={[0, 60]}
                xLabel="Delivery time (min)"
                unit="min"
                labelWidth={96}
              />
            </ChartFigure>
          ))}
        </div>
      </section>

      <ChartFigure
        title="Road distance and delivery time"
        tag={MODEL_INPUT}
        description={`A sample of ${formatCount(points.length)} of the ${formatCount(eda.distance.orders)} orders with a road distance. The line is the average for each 2 km band, and the shaded area covers the middle half of orders in that band.`}
        takeaway={`Longer routes take longer, but only up to a point: about 21 minutes under 4 km, rising to about 30 minutes at 16 km, then flat. The correlation is ${formatFixed(eda.distance.pearson)}, so distance explains only part of the variation.`}
        legend={[
          { name: "Average", color: "var(--series-2)", shape: "line" },
          { name: "Orders (sample)", color: "var(--series-1)", shape: "dot" },
        ]}
        table={{
          columns: [{ label: "Road distance" }, { label: "Orders", numeric: true }, { label: "Mean (min)", numeric: true }],
          rows: bins.map((bin) => [`${bin.from}–${bin.to} km`, bin.orders, formatFixed(bin.mean, 1)]),
        }}
      >
        <LineChart
          ariaLabel="Scatter of road distance against delivery time, with the average per distance band"
          series={[
            {
              id: "mean",
              name: "Average",
              color: "var(--series-2)",
              points: bins.map((bin) => [(bin.from + bin.to) / 2, bin.mean]),
              band: bins.map((bin) => [(bin.from + bin.to) / 2, bin.q1, bin.q3]),
            },
          ]}
          clouds={[{ id: "orders", name: "Orders", color: "var(--series-1)", points }]}
          xDomain={[0, 40]}
          yDomain={[0, 60]}
          xLabel="Road distance (km)"
          yLabel="Delivery time (min)"
          unit="min"
          height={320}
        />
      </ChartFigure>

      <div className="figure-grid">
        <ChartFigure
          title="Missing values"
          description="Empty values per column in the raw CSV and after cleaning. Columns with none are left out."
          takeaway="Road distance is missing most often, because some coordinates are invalid and some points are too far from a road. Rows without it are left out of training. Missing city and festival values are kept and filled with “unknown”."
          legend={[
            { name: "In the CSV", color: "var(--ordinal-1)" },
            { name: "After cleaning", color: "var(--ordinal-3)" },
          ]}
          table={{
            columns: [{ label: "Column" }, { label: "In the CSV", numeric: true }, { label: "After cleaning", numeric: true }],
            rows: missing.map((row) => [row.label, row.raw_missing ?? "—", row.missing_after_cleaning ?? "—"]),
          }}
        >
          <BarList
            format="count"
            labelWidth="9.5rem"
            series={[
              { id: "raw", name: "In the CSV", color: "var(--ordinal-1)" },
              { id: "cleaned", name: "After cleaning", color: "var(--ordinal-3)" },
            ]}
            rows={missing.map((row) => ({
              label: row.label,
              tag: row.model_input ? "Model input" : undefined,
              values: { raw: row.raw_missing, cleaned: row.missing_after_cleaning },
            }))}
          />
        </ChartFigure>

        <ChartFigure
          title="Correlation with delivery time"
          description="Pearson correlation of each numeric column with delivery time. Blue bars rise with delivery time, red bars fall."
          takeaway="The strongest numeric signals, multiple deliveries and rider rating, aren't known at order time. Road distance is the strongest one the app can use."
          table={{
            columns: [
              { label: "Column" },
              { label: "Pearson", numeric: true },
              { label: "Spearman", numeric: true },
              { label: "Orders", numeric: true },
            ],
            rows: eda.correlation.map((row) => [row.label, formatFixed(row.pearson, 3), formatFixed(row.spearman, 3), row.orders]),
          }}
        >
          <BarList
            format="signed2"
            signed
            max={0.5}
            labelWidth="9.5rem"
            series={[{ id: "pearson", name: "Pearson", color: "var(--series-1)" }]}
            rows={eda.correlation.map((row) => ({
              label: row.label,
              tag: row.model_input ? "Model input" : undefined,
              values: { pearson: row.pearson },
            }))}
          />
        </ChartFigure>
      </div>
    </>
  );
}
