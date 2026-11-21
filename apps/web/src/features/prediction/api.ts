import {
  PREDICTION_ENDPOINT_AVAILABLE,
  PREDICTION_ENDPOINT_PATH,
  type PredictionFormValues,
  type PredictionResult,
} from "./types";

const DEFAULT_API_BASE_URL = "http://localhost:8600";

export class PredictionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PredictionUnavailableError";
  }
}

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return (configured || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export async function requestDeliveryPrediction(
  values: PredictionFormValues
): Promise<PredictionResult> {
  if (!PREDICTION_ENDPOINT_AVAILABLE) {
    throw new PredictionUnavailableError(
      "Live predictions are not available yet because the FastAPI prediction endpoint is pending."
    );
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${getApiBaseUrl()}${PREDICTION_ENDPOINT_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        distance_km: Number(values.distanceKm),
        traffic_level: values.trafficLevel,
        weather_condition: values.weatherCondition,
        order_time: values.orderTime,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `Backend returned HTTP ${response.status}.`;
      try {
        const errorBody = (await response.json()) as { detail?: string };
        if (typeof errorBody.detail === "string" && errorBody.detail.trim()) {
          detail = errorBody.detail;
        }
      } catch {
        // Keep HTTP status fallback when response body is not JSON.
      }
      throw new Error(detail);
    }

    const payload = (await response.json()) as {
      estimated_minutes?: number;
      model_version?: string;
    };

    if (typeof payload.estimated_minutes !== "number" || !Number.isFinite(payload.estimated_minutes)) {
      throw new Error("Received an invalid prediction payload from the backend.");
    }

    return {
      estimatedMinutes: payload.estimated_minutes,
      modelVersion: payload.model_version,
      submittedConditions: { ...values },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Prediction request timed out. Verify the backend is running and try again.");
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unable to reach the prediction service. Please try again.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

