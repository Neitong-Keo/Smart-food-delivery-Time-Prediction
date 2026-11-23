"use client";

import { Check, FlaskConical, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { formatClock, formatMinutes } from "@/lib/format";
import type { RouteSummary } from "@/types/location";
import type { PredictionResponse } from "@/types/prediction";

const STAGES = ["Order preparation", "Food pickup", "Delivery in progress", "Estimated arrival"];

interface PredictionResultProps {
  result: PredictionResponse;
  requestedAt: Date;
  route: RouteSummary;
  timeZone?: string | null;
  saveState: "pending" | "saved" | "failed";
  onNewOrder: () => void;
}

export function PredictionResult({ result, requestedAt, route, timeZone, saveState, onNewOrder }: PredictionResultProps) {
  const container = useRef<HTMLElement | null>(null);
  const minutes = result.predicted_delivery_time_minutes;
  const arrival = new Date(requestedAt.getTime() + minutes * 60_000);
  const driveMinutes = route.durationMinutes;
  const scale = Math.max(minutes, driveMinutes ?? 0);

  useEffect(() => {
    container.current?.focus({ preventScroll: true });
    container.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  return (
    <section ref={container} className="result" tabIndex={-1} aria-labelledby="result-heading">
      <div>
        <h2 id="result-heading" className="result-heading">
          Your estimated delivery time
        </h2>
        <p className="result-time">
          {minutes}
          <span>{minutes === 1 ? "minute" : "minutes"}</span>
        </p>
        <p className="result-arrival">Arriving around {formatClock(arrival, timeZone)}</p>

        {result.model_status === "demo" ? (
          <p className="result-status">
            <FlaskConical size={16} aria-hidden />
            <span>
              <strong>Demo result.</strong> This time comes from a placeholder rule based on
              distance, not a trained model.
            </span>
          </p>
        ) : (
          <p className="result-status result-status-live">
            <Sparkles size={16} aria-hidden />
            <span>Predicted by the trained model.</span>
          </p>
        )}

        {result.warnings.map((issue) => (
          <p key={issue.code} className="result-warning">
            <TriangleAlert size={16} aria-hidden />
            <span>{issue.message}</span>
          </p>
        ))}
      </div>

      <div className="result-details">
        <div>
          <h3 className="compare-title">Delivery time and drive time</h3>
          <dl className="compare">
            <div className="compare-row">
              <div className="compare-labels">
                <dt>{result.model_status === "demo" ? "Demo delivery time" : "Predicted delivery time"}</dt>
                <dd>{formatMinutes(minutes)}</dd>
              </div>
              <div className="compare-track" aria-hidden="true">
                <span className="compare-fill compare-fill-total" style={{ width: `${(minutes / scale) * 100}%` }} />
              </div>
            </div>
            <div className="compare-row">
              <div className="compare-labels">
                <dt>Estimated drive time</dt>
                <dd>{driveMinutes !== null ? formatMinutes(driveMinutes) : "Not available"}</dd>
              </div>
              <div className="compare-track" aria-hidden="true">
                {driveMinutes !== null && (
                  <span className="compare-fill" style={{ width: `${(driveMinutes / scale) * 100}%` }} />
                )}
              </div>
            </div>
          </dl>
          <p className="compare-note">
            Drive time only covers the road. Delivery time covers the whole order.
          </p>
        </div>

        <ol className="timeline" aria-label="Delivery stages">
          {STAGES.map((stage) => (
            <li key={stage} className="timeline-stage">
              {stage}
            </li>
          ))}
        </ol>
      </div>

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
