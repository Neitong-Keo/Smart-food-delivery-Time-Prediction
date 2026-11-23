"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDeliveryDraft } from "@/hooks/use-delivery-draft";
import { routeKey } from "@/lib/geo";
import { RouteError, computeRoadRoute } from "@/services/maps/routing.service";
import type { DeliveryLocation } from "@/types/location";
import type { Restaurant } from "@/types/restaurant";

export type RouteStatus = "idle" | "loading" | "ready" | "error";

/** Keep the draft's road route in step with the selected restaurant and destination. */
export function useDeliveryRoute(restaurant: Restaurant | null, location: DeliveryLocation | null) {
  const { draft, setRoute } = useDeliveryDraft();
  const [status, setStatus] = useState<RouteStatus>("idle");
  const [warning, setWarning] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const storedRoute = useRef(draft.route);
  storedRoute.current = draft.route;

  const key = restaurant && location ? routeKey(restaurant.id, location) : null;
  const originLat = restaurant?.latitude;
  const originLng = restaurant?.longitude;
  const destinationLat = location?.lat;
  const destinationLng = location?.lng;

  useEffect(() => {
    if (
      !key ||
      originLat === undefined ||
      originLng === undefined ||
      destinationLat === undefined ||
      destinationLng === undefined
    ) {
      setStatus("idle");
      setWarning(null);
      return;
    }

    if (storedRoute.current?.key === key) {
      setWarning(null);
      setStatus("ready");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setWarning(null);
    computeRoadRoute(
      key,
      { lat: originLat, lng: originLng },
      { lat: destinationLat, lng: destinationLng },
      controller.signal,
    )
      .then((route) => {
        if (controller.signal.aborted) return;
        setRoute(route);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRoute(null);
        setWarning(
          error instanceof RouteError
            ? error.message
            : "The road route couldn't be loaded. Check your connection and try again.",
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, [key, originLat, originLng, destinationLat, destinationLng, attempt, setRoute]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const route = draft.route?.key === key ? draft.route : null;
  return { route, status, warning, retry };
}
