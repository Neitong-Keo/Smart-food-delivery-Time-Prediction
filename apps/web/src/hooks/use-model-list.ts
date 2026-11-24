"use client";

import { useCallback, useEffect, useState } from "react";

import { getErrorMessage, isAbortError } from "@/services/api/api-client";
import { getModelList } from "@/services/api/prediction.service";
import type { ModelList } from "@/types/prediction";

/** The models the API can predict with, for the model picker. */
export function useModelList() {
  const [list, setList] = useState<ModelList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    getModelList(controller.signal)
      .then(setList)
      .catch((reason: unknown) => {
        if (isAbortError(reason)) return;
        setList(null);
        setError(getErrorMessage(reason));
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { list, error, retry };
}
