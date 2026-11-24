import type { Metadata } from "next";

import { ChartFigure, DataTable } from "@/components/charts/ChartFigure";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { PARTITION_COLORS, formatCount, modelReport } from "@/lib/report";

export const metadata: Metadata = { title: "Data split" };

const PURPOSE: Record<string, { key: keyof typeof PARTITION_COLORS; body: string }> = {
  Training: {
    key: "training",
    body: "The models learn from these orders. Every fitted step, including the median used to fill gaps and the one-hot categories, comes from here only.",
  },
  Validation: {
    key: "validation",
    body: "Used to compare the models and choose each one's settings. The model with the lowest error here is the one the app selects.",
  },
  Test: {
    key: "test",
    body: "Checked once, at the end, after refitting on training and validation orders. These scores are the honest estimate of how the app will do.",
  },
};

const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Every calendar day from the first order to the last, so gaps in the data stay visible. */
function calendarDays(daily: typeof modelReport.split.daily) {
  const byDate = new Map(daily.map((day) => [day.date, day]));
  const days = [];
  const last = new Date(`${daily[daily.length - 1].date}T00:00:00Z`);
  for (let date = new Date(`${daily[0].date}T00:00:00Z`); date <= last; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    days.push(byDate.get(key) ?? { date: key, training: 0, validation: 0, test: 0 });
  }
  return days;
}

export default function SplitPage() {
  const { split } = modelReport;
  const days = calendarDays(split.daily);
  const used = split.partitions.reduce((sum, partition) => sum + partition.rows, 0);
  const series = split.partitions.map((partition) => ({
    id: PURPOSE[partition.name].key,
    name: partition.name,
    color: PARTITION_COLORS[PURPOSE[partition.name].key],
  }));

  return (
    <>
      <header>
        <p className="tech-eyebrow">4. Data split</p>
        <h1 className="page-heading">Train on the past, test on the future</h1>
        <p className="tech-lede">
          The {formatCount(used)} usable orders are sorted by when they were placed, then cut at 70% and 85%. The model
          learns from the oldest orders and is tested on the newest, the same way the app will use it.
        </p>
      </header>

      <section className="tech-section" aria-labelledby="why-title">
        <h2 id="why-title">Why not a random split?</h2>
        <p>
          A random split mixes orders from the same days into training and testing. The model could then learn
          something about a busy evening from orders in that same evening and look better than it really is, because it
          has effectively seen the future. Splitting by time removes that shortcut: every test order was placed after every
          training order.
        </p>
        <p>
          The cut points never split orders placed at the same minute, so the shares are as close to 70/15/15 as the
          timestamps allow.
        </p>
      </section>

      <DataTable
        table={{
          columns: [
            { label: "Partition" },
            { label: "Orders", numeric: true },
            { label: "Share", numeric: true },
            { label: "First order" },
            { label: "Last order" },
          ],
          rows: split.partitions.map((partition) => [
            partition.name,
            partition.rows,
            `${partition.share}%`,
            partition.first,
            partition.last,
          ]),
        }}
      />

      <ChartFigure
        title="Orders per day, by partition"
        description="Each column is one calendar day. Empty days are dates with no orders in the dataset."
        takeaway="Training covers about six weeks. Validation and test each cover about one week at the end."
        legend={series.map((item) => ({ name: item.name, color: item.color }))}
        table={{
          columns: [
            { label: "Date" },
            { label: "Training", numeric: true },
            { label: "Validation", numeric: true },
            { label: "Test", numeric: true },
          ],
          rows: split.daily.map((day) => [day.date, day.training, day.validation, day.test]),
        }}
      >
        <ColumnChart
          ariaLabel="Stacked columns of orders per day, coloured by partition"
          data={days.map((day) => ({
            label: shortDate(day.date),
            values: { training: day.training, validation: day.validation, test: day.test },
          }))}
          series={series}
          stacked
          yLabel="Orders"
          unit="orders"
          labelEvery={7}
          height={280}
        />
      </ChartFigure>

      <section className="tech-section" aria-labelledby="purpose-title">
        <h2 id="purpose-title">What each partition is for</h2>
        <dl className="figure-grid-3">
          {split.partitions.map((partition) => (
            <div key={partition.name} className="stat">
              <dt>
                <span
                  className="partition-key"
                  style={{ background: PARTITION_COLORS[PURPOSE[partition.name].key] }}
                  aria-hidden="true"
                />
                {partition.name}
              </dt>
              <dd>{formatCount(partition.rows)}</dd>
              <dd className="stat-note">{PURPOSE[partition.name].body}</dd>
            </div>
          ))}
        </dl>
        <p>
          Before the split, {formatCount(split.rows_missing_road_distance)} orders without a road distance,{" "}
          {formatCount(split.rows_outside_road_distance_limits)} outside the app&apos;s distance limits and{" "}
          {formatCount(split.rows_without_usable_timestamp)} without an order time were left out.
        </p>
      </section>
    </>
  );
}
