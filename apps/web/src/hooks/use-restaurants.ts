"use client";

import { useCallback, useEffect, useState } from "react";

import { getErrorMessage, isAbortError } from "@/services/api/api-client";
import { getRestaurant, listRestaurants } from "@/services/api/restaurant.service";
import type { Restaurant, RestaurantFilters, RestaurantListResponse } from "@/types/restaurant";

type LoadStatus = "loading" | "success" | "error";

export function useRestaurants({ search = "", cuisine = "" }: RestaurantFilters) {
  const [data, setData] = useState<RestaurantListResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    listRestaurants({ search, cuisine }, controller.signal)
      .then((response) => {
        setData(response);
        setStatus("success");
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason)) return;
        setError(getErrorMessage(reason));
        setStatus("error");
      });
    return () => controller.abort();
  }, [search, cuisine, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, status, error, retry };
}

export function useRestaurant(id: string | null) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) {
      setRestaurant(null);
      setStatus("success");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    getRestaurant(id, controller.signal)
      .then((response) => {
        setRestaurant(response);
        setStatus("success");
      })
      .catch((reason: unknown) => {
        if (isAbortError(reason)) return;
        setRestaurant(null);
        setError(getErrorMessage(reason));
        setStatus("error");
      });
    return () => controller.abort();
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { restaurant, status, error, retry };
}
