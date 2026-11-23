"use client";

import { useEffect, useRef, useState } from "react";

import { buildPredictionRequest, type PredictionInput } from "@/lib/prediction-request";
import { isAbortError } from "@/services/api/api-client";
import { requestPredictionPreview } from "@/services/api/prediction.service";
import type { PredictionPreview } from "@/types/prediction";

/** Keep the backend's view of the model inputs in step with the current order. */
export function usePredictionPreview(input: PredictionInput | null) {
  const [preview, setPreview] = useState<PredictionPreview | null>(null);
  const latestInput = useRef(input);
  latestInput.current = input;

  const key = input
    ? [
        input.restaurant.id,
        input.location.lat,
        input.location.lng,
        input.route.key,
        input.route.distanceKm,
        input.orderType,
        input.isFestival,
      ].join("|")
    : null;

  useEffect(() => {
    const current = latestInput.current;
    if (!key || !current) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    requestPredictionPreview(buildPredictionRequest(current), controller.signal)
      .then(setPreview)
      .catch((error: unknown) => {
        // The prediction request reports API problems, so a failed check doesn't block the order.
        if (!isAbortError(error)) setPreview(null);
      });
    return () => controller.abort();
  }, [key]);

  return preview;
}
