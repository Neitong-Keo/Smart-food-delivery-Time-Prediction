"use client";

import { useCallback, useRef, useState } from "react";

import { useDeliveryDraft } from "@/hooks/use-delivery-draft";
import { DELIVERY_AREA_NAME, isInDeliveryArea } from "@/lib/config";
import { formatCoordinates } from "@/lib/format";
import { isValidLatLng } from "@/lib/geo";
import { reverseGeocode } from "@/services/maps/geocoding.service";
import type { DeliveryLocation, LatLng, LocationSource } from "@/types/location";

export const OUTSIDE_AREA_MESSAGE = `The demo only covers ${DELIVERY_AREA_NAME}, where the model's orders were delivered. Choose a location on the map.`;

export function useDeliveryLocation() {
  const { draft, setLocation } = useDeliveryDraft();
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestPick = useRef(0);

  /** Place the pin immediately, then fill in the street address. */
  const pickPoint = useCallback(
    async (point: LatLng, source: LocationSource, knownAddress?: string) => {
      if (!isValidLatLng(point)) {
        setError("Enter a valid latitude and longitude.");
        return;
      }
      if (!isInDeliveryArea(point)) {
        setError(OUTSIDE_AREA_MESSAGE);
        return;
      }
      const pickId = ++latestPick.current;
      const fallbackAddress = knownAddress ?? `Pinned location (${formatCoordinates(point.lat, point.lng)})`;
      setError(null);
      setLocation({ ...point, address: fallbackAddress, source });

      if (knownAddress) {
        setIsResolving(false);
        return;
      }
      setIsResolving(true);
      try {
        const address = await reverseGeocode(point);
        if (pickId === latestPick.current && address) {
          setLocation({ ...point, address, source });
        }
      } catch {
        if (pickId === latestPick.current) {
          setError("The street address couldn't be found. The pin location is still saved.");
        }
      } finally {
        if (pickId === latestPick.current) setIsResolving(false);
      }
    },
    [setLocation],
  );

  const pickResolved = useCallback(
    (location: DeliveryLocation) => {
      if (!isInDeliveryArea(location)) {
        setError(OUTSIDE_AREA_MESSAGE);
        return;
      }
      latestPick.current += 1;
      setIsResolving(false);
      setError(null);
      setLocation(location);
    },
    [setLocation],
  );

  const reportOutside = useCallback(() => setError(OUTSIDE_AREA_MESSAGE), []);

  return {
    location: draft.location,
    isResolving,
    error,
    setError,
    pickPoint,
    pickResolved,
    reportOutside,
  };
}
