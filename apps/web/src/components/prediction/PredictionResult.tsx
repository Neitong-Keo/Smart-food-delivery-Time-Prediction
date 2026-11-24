"use client";

import { Check, FlaskConical, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { formatClock, formatMinutes } from "@/lib/format";
import type { RouteSummary } from "@/types/location";
import type { ModelPrediction, PredictionComparison } from "@/types/prediction";

interface PredictionResultProps {
  result: PredictionComparison;
  /** The prediction to feature, from the model picker. */
  shown: ModelPrediction;
  /** When the order was placed, with its UTC offset. */
  placedAt: string;
  route: RouteSummary;
  timeZone?: string | null;
  saveState: "pending" | "saved" | "failed";
  onNewOrder: () => void;
}

const formatMae = (value: number | null) => (value === null ? "Not recorded" : `${value.toFixed(2)} min`);

export function PredictionResult({
  result,
  shown,
  placedAt,
  route,
  timeZone,
  saveState,
  onNewOrder,
}: PredictionResultProps) {
  const container = useRef<HTMLElement | null>(null);
  const minutes = shown.predicted_delivery_time_minutes;
  const placed = new Date(placedAt);
  const arrival = minutes !== null ? new Date(placed.getTime() + minutes * 60_000) : null;
  const isDemo = result.model_status === "demo";
  const comparable = result.predictions.length > 1;

  useEffect(() => {
    container.current?.focus({ preventScroll: true });
    container.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  return (
    <section ref={container} className="result" tabIndex={-1} aria-labelledby="result-heading">
      <div>
        <h2 id="result-heading" className="result-heading">
          {comparable ? `${shown.model_name} predicts` : "Estimated delivery time"}
        </h2>
        {minutes !== null ? (
          <p className="result-time" aria-live="polite">
            {minutes}
            <span>{minutes === 1 ? "minute" : "minutes"}</span>
          </p>
        ) : (
          <p className="result-arrival">{shown.detail ?? "This model couldn't predict this order."}</p>
        )}
        {arrival && (
          <p className="result-arrival">
            Ordered {formatClock(placed, timeZone)}, arriving around {formatClock(arrival, timeZone)}
          </p>
        )}

        {isDemo ? (
          <p className="result-status">
            <FlaskConical size={16} aria-hidden />
            <span>
              <strong>Demo result.</strong> A placeholder rule based on distance, not a trained model.
            </span>
          </p>
        ) : (
          <p className="result-status result-status-live">
            <Sparkles size={16} aria-hidden />
            <span>Predicted by a trained model. Drive time without traffic: {formatMinutes(route.durationMinutes)}.</span>
          </p>
        )}

        {result.warnings.map((issue) => (
          <p key={issue.code} className="result-warning">
            <TriangleAlert size={16} aria-hidden />
            <span>{issue.message}</span>
          </p>
        ))}
      </div>

      {comparable && (
        <div className="result-details">
          <table className="result-table">
            <caption>Every model, same order</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col" className="is-numeric">
                  This order
                </th>
                <th scope="col" className="is-numeric">
                  Test MAE
                </th>
              </tr>
            </thead>
            <tbody>
              {result.predictions.map((prediction) => (
                <tr key={prediction.model_id} aria-current={prediction.model_id === shown.model_id ? "true" : undefined}>
                  <th scope="row">
                    {prediction.model_name}
                    {prediction.selected && <span className="result-table-tag">Selected</span>}
                  </th>
                  <td className="is-numeric">
                    {prediction.predicted_delivery_time_minutes !== null
                      ? formatMinutes(prediction.predicted_delivery_time_minutes)
                      : "Unavailable"}
                  </td>
                  <td className="is-numeric">{formatMae(prediction.test_mae)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="compare-note">
            Test MAE is each model&apos;s average error on newer orders it never saw in training.{" "}
            <Link href="/technical/evaluation">How the models compare</Link>
          </p>
        </div>
      )}

      <div className="result-actions">
        <button type="button" className="button button-primary" onClick={onNewOrder}>
          Start a new order
        </button>
        <Link href="/history" className="button button-on-dark">
          View history
        </Link>
        {saveState === "saved" && (
          <span className="result-saved" role="status">
            <Check size={15} aria-hidden />
            Saved to history
          </span>
        )}
        {saveState === "failed" && (
          <span className="result-saved" role="alert">
            This result couldn&apos;t be saved to history.
          </span>
        )}
      </div>
    </section>
  );
}
