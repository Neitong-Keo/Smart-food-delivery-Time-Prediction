import { isValidLatLng } from "@/lib/geo";
import type {
  ModelInfo,
  ModelList,
  ModelPrediction,
  ModelScores,
  ModelSummary,
  PredictionComparison,
  PredictionIssue,
  PredictionPreview,
  PredictionRequest,
  PredictionResponse,
} from "@/types/prediction";
import { ORDER_TYPES } from "@/types/prediction";
import type { Restaurant, RestaurantListResponse } from "@/types/restaurant";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isNullableString = (value: unknown) => value === null || typeof value === "string";

export function parseRestaurant(value: unknown): Restaurant {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.address) ||
    !isFiniteNumber(value.latitude) ||
    !isFiniteNumber(value.longitude) ||
    !isValidLatLng({ lat: value.latitude, lng: value.longitude }) ||
    !isNullableString(value.cuisine) ||
    !(value.rating === null || isFiniteNumber(value.rating)) ||
    !isNullableString(value.image_url) ||
    !(value.time_zone === undefined || isNullableString(value.time_zone))
  ) {
    throw new Error("Invalid restaurant record.");
  }
  return value as unknown as Restaurant;
}

export function parseRestaurantList(value: unknown): RestaurantListResponse {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !isFiniteNumber(value.total) ||
    !Array.isArray(value.cuisines) ||
    !value.cuisines.every((cuisine) => typeof cuisine === "string") ||
    (value.data_source !== "sample" && value.data_source !== "database")
  ) {
    throw new Error("Invalid restaurant list.");
  }
  return {
    items: value.items.map(parseRestaurant),
    total: value.total,
    cuisines: value.cuisines as string[],
    data_source: value.data_source,
  };
}

const isIssue = (value: unknown): value is PredictionIssue =>
  isRecord(value) &&
  isNonEmptyString(value.code) &&
  (value.severity === "warning" || value.severity === "blocked") &&
  isNonEmptyString(value.message);

export function parsePredictionResponse(value: unknown): PredictionResponse {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.predicted_delivery_time_minutes) ||
    value.predicted_delivery_time_minutes <= 0 ||
    (value.model_status !== "demo" && value.model_status !== "live")
  ) {
    throw new Error("Invalid prediction response.");
  }
  return {
    predicted_delivery_time_minutes: value.predicted_delivery_time_minutes,
    model_status: value.model_status,
    warnings: Array.isArray(value.warnings) ? value.warnings.filter(isIssue) : [],
  };
}

const parseScores = (value: unknown): ModelScores | null => {
  if (!isRecord(value) || !isFiniteNumber(value.mae) || !isFiniteNumber(value.rmse) || !isFiniteNumber(value.r2)) {
    return null;
  }
  return {
    mae: value.mae,
    rmse: value.rmse,
    r2: value.r2,
    mean_signed_error_minutes: isFiniteNumber(value.mean_signed_error_minutes)
      ? value.mean_signed_error_minutes
      : null,
  };
};

function parseModelSummary(value: unknown): ModelSummary {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    typeof value.selected !== "boolean" ||
    !["demo", "live", "unavailable"].includes(String(value.status))
  ) {
    throw new Error("Invalid model summary.");
  }
  return {
    id: value.id,
    name: value.name,
    selected: value.selected,
    status: value.status as ModelSummary["status"],
    detail: typeof value.detail === "string" ? value.detail : null,
    validation: parseScores(value.validation),
    test: parseScores(value.test),
  };
}

export function parseModelList(value: unknown): ModelList {
  if (!isRecord(value) || !isNonEmptyString(value.selected_model_id) || !Array.isArray(value.models)) {
    throw new Error("Invalid model list.");
  }
  const models = value.models.map(parseModelSummary);
  if (!models.some((model) => model.id === value.selected_model_id)) {
    throw new Error("The selected model is missing from the list.");
  }
  return { selected_model_id: value.selected_model_id, models };
}

function parseModelPrediction(value: unknown): ModelPrediction {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.model_id) ||
    !isNonEmptyString(value.model_name) ||
    typeof value.selected !== "boolean" ||
    !(value.predicted_delivery_time_minutes === null ||
      (isFiniteNumber(value.predicted_delivery_time_minutes) && value.predicted_delivery_time_minutes > 0))
  ) {
    throw new Error("Invalid model prediction.");
  }
  return {
    model_id: value.model_id,
    model_name: value.model_name,
    selected: value.selected,
    predicted_delivery_time_minutes: value.predicted_delivery_time_minutes as number | null,
    detail: typeof value.detail === "string" ? value.detail : null,
    test_mae: isFiniteNumber(value.test_mae) ? value.test_mae : null,
  };
}

export function parsePredictionComparison(value: unknown): PredictionComparison {
  if (
    !isRecord(value) ||
    (value.model_status !== "demo" && value.model_status !== "live") ||
    !isNonEmptyString(value.selected_model_id) ||
    !Array.isArray(value.predictions) ||
    value.predictions.length === 0
  ) {
    throw new Error("Invalid prediction comparison.");
  }
  return {
    model_status: value.model_status,
    selected_model_id: value.selected_model_id,
    predictions: value.predictions.map(parseModelPrediction),
    warnings: Array.isArray(value.warnings) ? value.warnings.filter(isIssue) : [],
  };
}

export function parsePredictionPreview(value: unknown): PredictionPreview {
  if (
    !isRecord(value) ||
    typeof value.can_predict !== "boolean" ||
    !isRecord(value.model_input) ||
    !Array.isArray(value.issues) ||
    !value.issues.every(isIssue)
  ) {
    throw new Error("Invalid prediction preview.");
  }
  return value as unknown as PredictionPreview;
}

export function parseModelInfo(value: unknown): ModelInfo {
  if (
    !isRecord(value) ||
    !["demo", "live", "unavailable"].includes(String(value.model_status)) ||
    !isNullableString(value.detail ?? null) ||
    !Array.isArray(value.feature_columns) ||
    !isRecord(value.limits) ||
    !isFiniteNumber(value.limits.training_road_distance_min_km) ||
    !isFiniteNumber(value.limits.training_road_distance_max_km) ||
    !isFiniteNumber(value.limits.blocked_road_distance_max_km)
  ) {
    throw new Error("Invalid model info.");
  }
  return { ...(value as unknown as ModelInfo), detail: (value.detail as string | null) ?? null, metrics: (value.metrics as ModelInfo["metrics"]) ?? null };
}

/** Return a message for the first problem, or null when the request can be sent. */
export function findPredictionRequestError(request: PredictionRequest): string | null {
  if (!request.restaurant_id) return "Choose a restaurant first.";
  if (!isValidLatLng({ lat: request.restaurant_latitude, lng: request.restaurant_longitude })) {
    return "This restaurant has no valid location.";
  }
  if (!isValidLatLng({ lat: request.delivery_latitude, lng: request.delivery_longitude })) {
    return "Set a delivery location first.";
  }
  if (!(request.road_distance_km >= 0)) {
    return "The road distance is invalid. Set the delivery location again.";
  }
  if (!(request.route_duration_minutes >= 0)) {
    return "The route duration is invalid. Set the delivery location again.";
  }
  if (!ORDER_TYPES.some((type) => type.value === request.order_type)) {
    return "Choose an order type.";
  }
  return null;
}
