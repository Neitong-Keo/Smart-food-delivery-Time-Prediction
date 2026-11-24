import { config } from "@/lib/config";
import {
  findPredictionRequestError,
  parseModelInfo,
  parseModelList,
  parsePredictionComparison,
  parsePredictionPreview,
  parsePredictionResponse,
} from "@/lib/validators";
import { ApiError, apiRequest } from "@/services/api/api-client";
import { MOCK_MODEL_LIST, compareWithMock, predictWithMock } from "@/services/api/prediction.mock";
import type {
  ModelInfo,
  ModelList,
  PredictionComparison,
  PredictionPreview,
  PredictionRequest,
  PredictionResponse,
} from "@/types/prediction";

function rejectInvalid(request: PredictionRequest): Promise<never> | null {
  const problem = findPredictionRequestError(request);
  return problem ? Promise.reject(new ApiError("validation", problem)) : null;
}

/** Validate a request and send it to the provider selected by configuration. */
export function requestPrediction(
  request: PredictionRequest,
  signal?: AbortSignal,
): Promise<PredictionResponse> {
  return (
    rejectInvalid(request) ??
    (config.predictionMode === "mock"
      ? predictWithMock(request, signal)
      : apiRequest("/api/predict", {
          method: "POST",
          body: request,
          signal,
          parse: parsePredictionResponse,
        }))
  );
}

/** Predict one order with every model the API serves, in one call. */
export function requestComparison(
  request: PredictionRequest,
  signal?: AbortSignal,
): Promise<PredictionComparison> {
  return (
    rejectInvalid(request) ??
    (config.predictionMode === "mock"
      ? compareWithMock(request, signal)
      : apiRequest("/api/predict/compare", {
          method: "POST",
          body: request,
          signal,
          parse: parsePredictionComparison,
        }))
  );
}

/** Ask the backend what the model would receive and whether the order is in range. */
export function requestPredictionPreview(
  request: PredictionRequest,
  signal?: AbortSignal,
): Promise<PredictionPreview> {
  return apiRequest("/api/predict/preview", {
    method: "POST",
    body: request,
    signal,
    parse: parsePredictionPreview,
  });
}

export function getModelInfo(signal?: AbortSignal): Promise<ModelInfo> {
  return apiRequest("/api/model", { signal, parse: parseModelInfo });
}

export function getModelList(signal?: AbortSignal): Promise<ModelList> {
  if (config.predictionMode === "mock") return Promise.resolve(MOCK_MODEL_LIST);
  return apiRequest("/api/models", { signal, parse: parseModelList });
}
