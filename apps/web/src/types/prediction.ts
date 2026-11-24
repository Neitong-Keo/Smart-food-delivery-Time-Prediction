export const ORDER_TYPES = [
  { value: "meal", label: "Meal" },
  { value: "snack", label: "Snack" },
  { value: "drinks", label: "Drinks" },
  { value: "buffet", label: "Buffet" },
] as const;

export type OrderType = (typeof ORDER_TYPES)[number]["value"];
export type ModelStatus = "demo" | "live";
export type ModelAvailability = ModelStatus | "unavailable";

/** Mirrors `PredictionRequest` in apps/backend/app/schemas/prediction.py. */
export interface PredictionRequest {
  restaurant_id: string;
  restaurant_latitude: number;
  restaurant_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  /** Actual distance along the road from the routing service. */
  road_distance_km: number;
  /** Drive time from the routing service, without live traffic. */
  route_duration_minutes: number;
  order_type: OrderType;
  is_festival: boolean;
  order_placed_at: string;
  /** Model to predict with. The API uses its selected model when this is left out. */
  model_id?: string;
}

export interface PredictionIssue {
  code: string;
  severity: "warning" | "blocked";
  message: string;
}

/** Mirrors `PredictionResponse` in apps/backend/app/schemas/prediction.py. */
export interface PredictionResponse {
  predicted_delivery_time_minutes: number;
  model_status: ModelStatus;
  model_id?: string;
  model_name?: string;
  warnings: PredictionIssue[];
}

/** Errors in minutes on one evaluation partition. */
export interface ModelScores {
  mae: number;
  rmse: number;
  r2: number;
  mean_signed_error_minutes: number | null;
}

/** Mirrors `ModelSummary` in apps/backend/app/schemas/prediction.py. */
export interface ModelSummary {
  id: string;
  name: string;
  selected: boolean;
  status: ModelAvailability;
  detail: string | null;
  validation: ModelScores | null;
  test: ModelScores | null;
}

export interface ModelList {
  selected_model_id: string;
  models: ModelSummary[];
}

/** One model's prediction for an order, or why it has none. */
export interface ModelPrediction {
  model_id: string;
  model_name: string;
  selected: boolean;
  predicted_delivery_time_minutes: number | null;
  detail: string | null;
  test_mae: number | null;
}

/** Mirrors `PredictionComparisonResponse`: every model's prediction for the same order. */
export interface PredictionComparison {
  model_status: ModelStatus;
  selected_model_id: string;
  predictions: ModelPrediction[];
  warnings: PredictionIssue[];
}

/** The exact inputs the backend would give the model for an order. */
export interface PredictionPreview {
  can_predict: boolean;
  model_input: Record<string, string | number | null>;
  issues: PredictionIssue[];
}

export interface ServingLimits {
  training_road_distance_min_km: number;
  training_road_distance_max_km: number;
  blocked_road_distance_min_km: number;
  blocked_road_distance_max_km: number;
  supported_order_hours: number[];
}

export interface ModelInfo {
  model_status: ModelAvailability;
  detail: string | null;
  feature_columns: string[];
  limits: ServingLimits;
  metrics: Record<string, string | number> | null;
}

export interface PredictionHistoryEntry {
  id: string;
  createdAt: string;
  restaurantId: string;
  restaurantName: string;
  restaurantImageUrl: string | null;
  destination: string;
  distanceKm: number;
  /** Only present on entries saved before predictions required a road route. */
  distanceSource?: "road" | "straight_line";
  mapsDurationMinutes: number | null;
  predictedMinutes: number;
  modelStatus: ModelStatus;
  /** The model chosen on the predict page, when one was chosen. */
  modelName?: string;
  outsideTrainingRange?: boolean;
}

export type NewPredictionHistoryEntry = Omit<PredictionHistoryEntry, "id" | "createdAt">;
