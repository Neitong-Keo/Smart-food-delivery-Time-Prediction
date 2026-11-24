import type {
  ModelList,
  PredictionComparison,
  PredictionRequest,
  PredictionResponse,
} from "@/types/prediction";

// Keep in step with apps/backend/app/services/prediction/demo.py.
const MOCK_BASE_MINUTES = 15;
const MOCK_MINUTES_PER_ROAD_KM = 0.9;
const MOCK_LATENCY_MS = 500;
const MOCK_MODEL = { id: "demo", name: "Demo rule" } as const;

export const MOCK_MODEL_LIST: ModelList = {
  selected_model_id: MOCK_MODEL.id,
  models: [
    {
      ...MOCK_MODEL,
      selected: true,
      status: "demo",
      detail: null,
      validation: null,
      test: null,
    },
  ],
};

function wait(signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, MOCK_LATENCY_MS);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

const mockMinutes = (request: PredictionRequest) =>
  Math.max(1, Math.round(MOCK_BASE_MINUTES + MOCK_MINUTES_PER_ROAD_KM * request.road_distance_km));

/** Frontend-only placeholder, enabled with NEXT_PUBLIC_PREDICTION_MODE=mock. */
export async function predictWithMock(
  request: PredictionRequest,
  signal?: AbortSignal,
): Promise<PredictionResponse> {
  await wait(signal);
  return {
    predicted_delivery_time_minutes: mockMinutes(request),
    model_status: "demo",
    model_id: MOCK_MODEL.id,
    model_name: MOCK_MODEL.name,
    warnings: [],
  };
}

export async function compareWithMock(
  request: PredictionRequest,
  signal?: AbortSignal,
): Promise<PredictionComparison> {
  await wait(signal);
  return {
    model_status: "demo",
    selected_model_id: MOCK_MODEL.id,
    predictions: [
      {
        model_id: MOCK_MODEL.id,
        model_name: MOCK_MODEL.name,
        selected: true,
        predicted_delivery_time_minutes: mockMinutes(request),
        detail: null,
        test_mae: null,
      },
    ],
    warnings: [],
  };
}
