"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getErrorMessage, isAbortError } from "@/services/api/api-client";
import { requestComparison } from "@/services/api/prediction.service";
import type { PredictionComparison, PredictionRequest } from "@/types/prediction";

export type PredictionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: PredictionComparison; requestedAt: Date; placedAt: string }
  | { status: "error"; message: string };

/** Predict one order with every model at once, so switching models needs no new request. */
export function usePrediction() {
  const [state, setState] = useState<PredictionState>({ status: "idle" });
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  const predict = useCallback(async (request: PredictionRequest) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState({ status: "loading" });
    try {
      const result = await requestComparison(request, controller.signal);
      if (controller.signal.aborted) return null;
      setState({ status: "success", result, requestedAt: new Date(), placedAt: request.order_placed_at });
      return result;
    } catch (error) {
      if (!isAbortError(error) && !controller.signal.aborted) {
        setState({ status: "error", message: getErrorMessage(error) });
      }
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    active.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, predict, reset };
}
