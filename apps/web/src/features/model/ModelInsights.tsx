"use client";

import Link from "next/link";

import { Notice } from "@/components/ui/Notice";
import { useModelInfo } from "@/hooks/use-model-info";

const FEATURE_LABELS: Record<string, string> = {
  Type_of_order: "Order type",
  Festival: "Festival or public holiday",
  City: "Area type",
  order_hour: "Hour of the order",
  order_day_of_week: "Day of the week",
  road_distance_km: "Actual road distance",
  route_duration_minutes: "Route drive time",
};

const formatMetricName = (name: string) =>
  name
    .replace(/_/g, " ")
    .replace(/\b(mae|rmse|r2)\b/gi, (match) => match.toUpperCase())
    .replace(/^./, (first) => first.toUpperCase());

const formatMetricValue = (value: string | number) =>
  typeof value === "number" ? String(Number(value.toFixed(3))) : value;

export function ModelInsights() {
  const { info, error, isLoading, retry } = useModelInfo();

  return (
    <>
      {isLoading && <div className="skeleton" role="status" aria-label="Loading model status" style={{ height: "4rem" }} />}

      {error && (
        <Notice
          tone="warning"
          title="Model status couldn't be checked"
          action={
            <button type="button" className="button button-secondary" onClick={retry}>
              Try again
            </button>
          }
        >
          {error}
        </Notice>
      )}

      {info?.model_status === "demo" && (
        <Notice tone="demo" title="The trained model isn't connected yet">
          Delivery times in this app are demo results based on road distance.
        </Notice>
      )}
      {info?.model_status === "live" && (
        <Notice tone="info" title="The trained model is connected">
          Delivery times in this app come from the saved model.
        </Notice>
      )}
      {info?.model_status === "unavailable" && (
        <Notice tone="error" title="The trained model couldn't be loaded">
          {info.detail}
        </Notice>
      )}

      {info?.metrics && (
        <dl className="model-summary">
          {Object.entries(info.metrics).map(([name, value]) => (
            <div key={name}>
              <dt>{formatMetricName(name)}</dt>
              <dd>{formatMetricValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {!info?.metrics && (
        <dl className="model-summary">
          <div>
            <dt>Benchmark to beat</dt>
            <dd>Median baseline</dd>
          </div>
          <div>
            <dt>Baseline prediction</dt>
            <dd>26 minutes</dd>
          </div>
          <div>
            <dt>Baseline validation error (MAE)</dt>
            <dd>7.75 minutes</dd>
          </div>
        </dl>
      )}

      {info && (
        <div className="model-details">
          <section>
            <h2>What the model receives</h2>
            <ul>
              {info.feature_columns.map((column) => (
                <li key={column}>{FEATURE_LABELS[column] ?? column}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Where predictions are reliable</h2>
            <p>
              The training data covers road distances from{" "}
              {info.limits.training_road_distance_min_km} to{" "}
              {info.limits.training_road_distance_max_km} km, ordered between 8 AM and midnight. The
              app warns outside this range and declines deliveries beyond{" "}
              {info.limits.blocked_road_distance_max_km} km by road.
            </p>
            <p>
              Distance always comes from the actual road route. It is never estimated from a
              straight line.
            </p>
          </section>
        </div>
      )}

      <p className="model-note">
        The baseline predicts the training set&apos;s median delivery time for every order. A useful
        model needs a lower error on the same validation orders.{" "}
        <Link href="/explore?tour=1" className="text-link">
          Take the route explorer tour
        </Link>
      </p>
    </>
  );
}
