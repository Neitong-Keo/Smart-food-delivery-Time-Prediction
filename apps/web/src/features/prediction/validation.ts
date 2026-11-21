import type {
  PredictionFieldErrors,
  PredictionFormValues,
  TrafficLevel,
  WeatherCondition,
} from "./types";

const ALLOWED_TRAFFIC: ReadonlySet<TrafficLevel> = new Set(["light", "moderate", "heavy"]);
const ALLOWED_WEATHER: ReadonlySet<WeatherCondition> = new Set(["clear", "rain", "storm"]);
const TIME_24H_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const MIN_DISTANCE_KM = 0.5;
export const MAX_DISTANCE_KM = 50;

export function validatePredictionForm(
  values: PredictionFormValues
): PredictionFieldErrors {
  const errors: PredictionFieldErrors = {};
  const trimmedDistance = values.distanceKm.trim();

  if (!trimmedDistance) {
    errors.distanceKm = "Enter a delivery distance in kilometers.";
  } else {
    const parsedDistance = Number(trimmedDistance);
    if (!Number.isFinite(parsedDistance)) {
      errors.distanceKm = "Distance must be a valid number (for example, 4.5).";
    } else if (parsedDistance < MIN_DISTANCE_KM || parsedDistance > MAX_DISTANCE_KM) {
      errors.distanceKm = `Distance must be between ${MIN_DISTANCE_KM} and ${MAX_DISTANCE_KM} km.`;
    }
  }

  if (!ALLOWED_TRAFFIC.has(values.trafficLevel)) {
    errors.trafficLevel = "Choose light, moderate, or heavy traffic.";
  }

  if (!ALLOWED_WEATHER.has(values.weatherCondition)) {
    errors.weatherCondition = "Choose clear, rain, or storm weather.";
  }

  const trimmedTime = values.orderTime.trim();
  if (!trimmedTime) {
    errors.orderTime = "Enter an order time in 24-hour HH:MM format.";
  } else if (!TIME_24H_PATTERN.test(trimmedTime)) {
    errors.orderTime = "Order time must be in 24-hour HH:MM format (for example, 18:30).";
  }

  return errors;
}

export function hasFieldErrors(errors: PredictionFieldErrors): boolean {
  return Object.values(errors).some((message) => Boolean(message));
}

