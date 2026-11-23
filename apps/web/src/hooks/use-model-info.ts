"use client";

import { useCallback, useEffect, useState } from "react";

import { getErrorMessage, isAbortError } from "@/services/api/api-client";
import { getModelInfo } from "@/services/api/prediction.service";
import type { ModelInfo } from "@/types/prediction";

export function useModelInfo() {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    getModelInfo(controller.signal)
      .then((result) => {
        setInfo(result);
        setIsLoading(false);
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason)) return;
        setInfo(null);
        setError(getErrorMessage(reason));
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { info, error, isLoading, retry };
}
