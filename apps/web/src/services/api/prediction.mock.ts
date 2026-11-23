import type { PredictionRequest, PredictionResponse } from "@/types/prediction";

// Keep in step with apps/backend/app/services/prediction/demo.py.
const MOCK_BASE_MINUTES = 15;
const MOCK_MINUTES_PER_ROAD_KM = 0.9;
const MOCK_LATENCY_MS = 500;

/** Frontend-only placeholder, enabled with NEXT_PUBLIC_PREDICTION_MODE=mock. */
export async function predictWithMock(
  request: PredictionRequest,
  signal?: AbortSignal,
): Promise<PredictionResponse> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, MOCK_LATENCY_MS);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

  return {
    predicted_delivery_time_minutes: Math.max(
      1,
      Math.round(MOCK_BASE_MINUTES + MOCK_MINUTES_PER_ROAD_KM * request.road_distance_km),
    ),
    model_status: "demo",
    warnings: [],
  };
}
