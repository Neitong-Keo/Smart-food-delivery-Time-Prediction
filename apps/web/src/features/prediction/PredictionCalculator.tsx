"use client";

import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";

import { requestDeliveryPrediction } from "./api";
import {
  DEFAULT_PREDICTION_FORM_VALUES,
  PREDICTION_ENDPOINT_AVAILABLE,
  type PredictionFieldErrors,
  type PredictionFormValues,
  type PredictionResult,
  type SubmissionStatus,
  type TrafficLevel,
  type WeatherCondition,
} from "./types";
import { hasFieldErrors, validatePredictionForm } from "./validation";

const TRAFFIC_LABELS: Record<TrafficLevel, string> = {
  light: "Light traffic",
  moderate: "Moderate congestion",
  heavy: "Heavy traffic",
};

const WEATHER_LABELS: Record<WeatherCondition, string> = {
  clear: "Clear skies",
  rain: "Rain",
  storm: "Storm",
};

export function PredictionCalculator() {
  const [values, setValues] = useState<PredictionFormValues>(DEFAULT_PREDICTION_FORM_VALUES);
  const [fieldErrors, setFieldErrors] = useState<PredictionFieldErrors>({});
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);

  const distanceInputRef = useRef<HTMLInputElement | null>(null);
  const inFlightRef = useRef(false);

  const isSubmitting = status === "submitting";

  const updateField = <K extends keyof PredictionFormValues>(
    field: K,
    nextValue: PredictionFormValues[K]
  ) => {
    setValues((prev) => ({
      ...prev,
      [field]: nextValue,
    }));

    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }

    if (requestError) {
      setRequestError(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (inFlightRef.current) {
      return;
    }

    const errors = validatePredictionForm(values);
    setFieldErrors(errors);

    if (hasFieldErrors(errors)) {
      setStatus("failed");
      setRequestError("Please fix the highlighted fields before requesting an estimate.");
      return;
    }

    inFlightRef.current = true;
    setStatus("submitting");
    setRequestError(null);

    try {
      const prediction = await requestDeliveryPrediction(values);
      setResult(prediction);
      setStatus("succeeded");
    } catch (error) {
      setStatus("failed");
      setRequestError(
        error instanceof Error
          ? error.message
          : "Prediction service is currently unavailable. Please try again later."
      );
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleEditInputs = () => {
    setResult(null);
    setStatus("idle");
    setRequestError(null);
    requestAnimationFrame(() => {
      distanceInputRef.current?.focus();
    });
  };

  return (
    <>
      {!PREDICTION_ENDPOINT_AVAILABLE && (
        <section className="callout callout-info" aria-label="Prediction availability notice">
          <h2 className="callout-title">Live predictions are not available yet</h2>
          <p className="callout-body">
            The FastAPI backend currently exposes <code>GET /api/health</code> only while the
            prediction contract and trained scikit-learn artifacts are pending. You can still test
            input validation below or explore sample route estimates in the guided tour.
          </p>
          <div className="callout-actions">
            <Link href="/?tour=1" className="button button-primary">
              Take the illustrative tour
            </Link>
            <Link href="/model" className="button button-secondary">
              View model insights
            </Link>
          </div>
        </section>
      )}

      <section className="card" aria-label="Delivery ETA calculator">
        <div className="route-header">
          <div>
            <p className="eyebrow">Delivery Conditions</p>
            <h2 className="card-title">Request a Delivery Time Estimate</h2>
          </div>
          {!PREDICTION_ENDPOINT_AVAILABLE && (
            <span className="badge badge-warning">Backend route pending</span>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="distance-km" className="field-label">
                Distance (km)
              </label>
              <input
                ref={distanceInputRef}
                id="distance-km"
                name="distanceKm"
                type="text"
                inputMode="decimal"
                className="text-input"
                value={values.distanceKm}
                onChange={(event) => updateField("distanceKm", event.target.value)}
                aria-invalid={Boolean(fieldErrors.distanceKm)}
                aria-describedby={
                  fieldErrors.distanceKm ? "distance-km-hint distance-km-error" : "distance-km-hint"
                }
              />
              <p id="distance-km-hint" className="field-hint">
                Route distance in kilometers (0.5 – 50 km).
              </p>
              {fieldErrors.distanceKm && (
                <p id="distance-km-error" className="field-error" role="alert">
                  {fieldErrors.distanceKm}
                </p>
              )}
            </div>

            <div className="field-group">
              <label htmlFor="traffic-level" className="field-label">
                Traffic level
              </label>
              <select
                id="traffic-level"
                name="trafficLevel"
                className="select-input"
                value={values.trafficLevel}
                onChange={(event) => updateField("trafficLevel", event.target.value as TrafficLevel)}
                aria-invalid={Boolean(fieldErrors.trafficLevel)}
                aria-describedby={
                  fieldErrors.trafficLevel ? "traffic-level-error" : undefined
                }
              >
                <option value="light">Light traffic</option>
                <option value="moderate">Moderate congestion</option>
                <option value="heavy">Heavy traffic</option>
              </select>
              {fieldErrors.trafficLevel && (
                <p id="traffic-level-error" className="field-error" role="alert">
                  {fieldErrors.trafficLevel}
                </p>
              )}
            </div>

            <div className="field-group">
              <label htmlFor="weather-condition" className="field-label">
                Weather condition
              </label>
              <select
                id="weather-condition"
                name="weatherCondition"
                className="select-input"
                value={values.weatherCondition}
                onChange={(event) =>
                  updateField("weatherCondition", event.target.value as WeatherCondition)
                }
                aria-invalid={Boolean(fieldErrors.weatherCondition)}
                aria-describedby={
                  fieldErrors.weatherCondition ? "weather-condition-error" : undefined
                }
              >
                <option value="clear">Clear skies</option>
                <option value="rain">Rain</option>
                <option value="storm">Storm</option>
              </select>
              {fieldErrors.weatherCondition && (
                <p id="weather-condition-error" className="field-error" role="alert">
                  {fieldErrors.weatherCondition}
                </p>
              )}
            </div>

            <div className="field-group">
              <label htmlFor="order-time" className="field-label">
                Order time
              </label>
              <input
                id="order-time"
                name="orderTime"
                type="time"
                className="text-input"
                value={values.orderTime}
                onChange={(event) => updateField("orderTime", event.target.value)}
                aria-invalid={Boolean(fieldErrors.orderTime)}
                aria-describedby={
                  fieldErrors.orderTime ? "order-time-hint order-time-error" : "order-time-hint"
                }
              />
              <p id="order-time-hint" className="field-hint">
                Local 24-hour order placement time (HH:MM).
              </p>
              {fieldErrors.orderTime && (
                <p id="order-time-error" className="field-error" role="alert">
                  {fieldErrors.orderTime}
                </p>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="button button-primary"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Estimating..." : "Estimate delivery time"}
            </button>

            <button
              type="button"
              className="button button-secondary"
              disabled={isSubmitting}
              onClick={() => {
                setValues(DEFAULT_PREDICTION_FORM_VALUES);
                setFieldErrors({});
                setRequestError(null);
              }}
            >
              Reset defaults
            </button>
          </div>
        </form>

        {requestError && (
          <div className="callout callout-error" role="alert" style={{ marginTop: "1.25rem" }}>
            <h3 className="callout-title">Unable to complete prediction</h3>
            <p className="callout-body">{requestError}</p>
            {!PREDICTION_ENDPOINT_AVAILABLE && (
              <div className="callout-actions">
                <Link href="/?tour=1" className="button button-secondary">
                  Open illustrative tour
                </Link>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="result-card" aria-live="polite" style={{ marginTop: "1.25rem" }}>
            <div className="route-header">
              <div>
                <p className="eyebrow">Predicted Delivery Time</p>
                <p className="eta-value">{Math.round(result.estimatedMinutes)} minutes</p>
              </div>
              {result.modelVersion && (
                <span className="badge badge-info">Model {result.modelVersion}</span>
              )}
            </div>

            <dl className="breakdown-list">
              <div className="breakdown-row">
                <dt>Distance</dt>
                <dd>{result.submittedConditions.distanceKm} km</dd>
              </div>
              <div className="breakdown-row">
                <dt>Traffic level</dt>
                <dd>{TRAFFIC_LABELS[result.submittedConditions.trafficLevel]}</dd>
              </div>
              <div className="breakdown-row">
                <dt>Weather condition</dt>
                <dd>{WEATHER_LABELS[result.submittedConditions.weatherCondition]}</dd>
              </div>
              <div className="breakdown-row">
                <dt>Order time</dt>
                <dd>{result.submittedConditions.orderTime}</dd>
              </div>
            </dl>

            <div className="card-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={handleEditInputs}
              >
                Edit conditions &amp; try again
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

