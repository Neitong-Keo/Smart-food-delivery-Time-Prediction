import { config } from "@/lib/config";
import {
  findPredictionRequestError,
  parseModelInfo,
  parsePredictionPreview,
  parsePredictionResponse,
} from "@/lib/validators";
import { ApiError, apiRequest } from "@/services/api/api-client";
import { predictWithMock } from "@/services/api/prediction.mock";
import type {
  ModelInfo,
  PredictionPreview,
  PredictionRequest,
  PredictionResponse,
} from "@/types/prediction";

function predictWithApi(
  request: PredictionRequest,
  signal?: AbortSignal,
): Promise<PredictionResponse> {
  return apiRequest("/api/predict", {
    method: "POST",
    body: request,
    signal,
    parse: parsePredictionResponse,
  });
}

/** Validate a request and send it to the provider selected by configuration. */
export function requestPrediction(
  request: PredictionRequest,
  signal?: AbortSignal,
): Promise<PredictionResponse> {
  const problem = findPredictionRequestError(request);
  if (problem) return Promise.reject(new ApiError("validation", problem));
  return config.predictionMode === "mock"
    ? predictWithMock(request, signal)
    : predictWithApi(request, signal);
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
