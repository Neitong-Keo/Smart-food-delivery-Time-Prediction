"use client";

import { useCallback, useRef, useState } from "react";

import { useDeliveryDraft } from "@/hooks/use-delivery-draft";
import { formatCoordinates } from "@/lib/format";
import { isValidLatLng } from "@/lib/geo";
import { reverseGeocode } from "@/services/maps/geocoding.service";
import type { DeliveryLocation, LatLng, LocationSource } from "@/types/location";

const GEOLOCATION_ERRORS: Record<number, string> = {
  1: "Location access is blocked. Allow it in your browser, or search for your address.",
  2: "Your location isn't available right now. Search for your address instead.",
  3: "Finding your location took too long. Try again, or search for your address.",
};

export function useDeliveryLocation() {
  const { draft, setLocation } = useDeliveryDraft();
  const [isResolving, setIsResolving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestPick = useRef(0);

  /** Place the pin immediately, then fill in the street address. */
  const pickPoint = useCallback(
    async (point: LatLng, source: LocationSource, knownAddress?: string) => {
      if (!isValidLatLng(point)) {
        setError("Enter a valid latitude and longitude.");
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
      latestPick.current += 1;
      setIsResolving(false);
      setError(null);
      setLocation(location);
    },
    [setLocation],
  );

  const locateUser = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("This browser can't share your location. Search for your address instead.");
      return;
    }
    setIsLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setIsLocating(false);
        void pickPoint({ lat: coords.latitude, lng: coords.longitude }, "geolocation");
      },
      ({ code }) => {
        setIsLocating(false);
        setError(GEOLOCATION_ERRORS[code] ?? GEOLOCATION_ERRORS[2]);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [pickPoint]);

  return {
    location: draft.location,
    isResolving,
    isLocating,
    error,
    setError,
    pickPoint,
    pickResolved,
    locateUser,
  };
}
