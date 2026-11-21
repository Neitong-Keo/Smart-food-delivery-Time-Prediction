export type TrafficLevel = "light" | "moderate" | "heavy";
export type WeatherCondition = "clear" | "rain" | "storm";

/**
 * Inspected apps/backend/app/api/v1/router.py and app/main.py:
 * only GET /api/health is currently implemented on the backend.
 * Flip this flag and align field names once the v1 prediction schema is published.
 */
export const PREDICTION_ENDPOINT_AVAILABLE = false;
export const PREDICTION_ENDPOINT_PATH = "/api/v1/predict";

export interface PredictionFormValues {
  distanceKm: string;
  trafficLevel: TrafficLevel;
  weatherCondition: WeatherCondition;
  orderTime: string;
}

export interface PredictionFieldErrors {
  distanceKm?: string;
  trafficLevel?: string;
  weatherCondition?: string;
  orderTime?: string;
}

export interface PredictionResult {
  estimatedMinutes: number;
  modelVersion?: string;
  submittedConditions: PredictionFormValues;
}

export type SubmissionStatus = "idle" | "submitting" | "succeeded" | "failed";

export const DEFAULT_PREDICTION_FORM_VALUES: PredictionFormValues = {
  distanceKm: "4.5",
  trafficLevel: "moderate",
  weatherCondition: "clear",
  orderTime: "18:30",
};

