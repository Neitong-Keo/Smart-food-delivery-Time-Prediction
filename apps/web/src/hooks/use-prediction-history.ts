"use client";

import { useCallback, useEffect, useState } from "react";

import { historyRepository } from "@/services/history/history.repository";
import type { PredictionHistoryEntry } from "@/types/prediction";

export function usePredictionHistory() {
  const [entries, setEntries] = useState<PredictionHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    historyRepository
      .list()
      .then(setEntries)
      .catch(() => setError("Your history couldn't be loaded."))
      .finally(() => setIsLoading(false));
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await historyRepository.remove(id);
      setEntries((current) => current.filter((entry) => entry.id !== id));
    } catch {
      setError("That prediction couldn't be removed.");
    }
  }, []);

  const clear = useCallback(async () => {
    try {
      await historyRepository.clear();
      setEntries([]);
    } catch {
      setError("Your history couldn't be cleared.");
    }
  }, []);

  return { entries, isLoading, error, remove, clear };
}
