"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState } from "react";

import { SchematicMap } from "@/components/maps/SchematicMap";
import { useDocumentTheme } from "@/hooks/use-document-theme";
import type { MapEngineState } from "@/hooks/use-map-engine";
import { createDeliveryMap, type DeliveryMapController } from "@/services/maps/map.service";
import type { DeliveryLocation, LatLng, RouteSummary } from "@/types/location";
import type { Restaurant } from "@/types/restaurant";

interface DeliveryMapProps {
  engine: MapEngineState;
  restaurant: Restaurant;
  location: DeliveryLocation | null;
  route: RouteSummary | null;
  interactive?: boolean;
  onPick?: (point: LatLng, source: "map" | "drag") => void;
  /** Called when a click or drag outside the delivery area is ignored. */
  onOutside?: () => void;
}

export function DeliveryMap({
  engine,
  restaurant,
  location,
  route,
  interactive = false,
  onPick,
  onOutside,
}: DeliveryMapProps) {
  const [failed, setFailed] = useState(false);
  const theme = useDocumentTheme();
  const origin = { lat: restaurant.latitude, lng: restaurant.longitude };

  if (engine.status === "unavailable" || failed) {
    return <SchematicMap origin={origin} destination={location} />;
  }
  if (engine.status === "loading") {
    return <div className="skeleton map-canvas" role="status" aria-label="Loading map" />;
  }
  return (
    // A new theme rebuilds the map, so its style, pins, and route are always in step.
    <MapCanvas
      key={theme}
      restaurant={restaurant}
      location={location}
      route={route}
      interactive={interactive}
      onPick={onPick}
      onOutside={onOutside}
      onFailure={() => setFailed(true)}
    />
  );
}

type CanvasProps = Omit<DeliveryMapProps, "engine"> & { onFailure: () => void };

function MapCanvas({
  restaurant,
  location,
  route,
  interactive = false,
  onPick,
  onOutside,
  onFailure,
}: CanvasProps) {
  const element = useRef<HTMLDivElement | null>(null);
  const latestPick = useRef(onPick);
  latestPick.current = onPick;
  const latestOutside = useRef(onOutside);
  latestOutside.current = onOutside;
  const latestFailure = useRef(onFailure);
  latestFailure.current = onFailure;
  const [controller, setController] = useState<DeliveryMapController | null>(null);

  const restaurantLat = restaurant.latitude;
  const restaurantLng = restaurant.longitude;

  useEffect(() => {
    if (!element.current) return;
    const abort = new AbortController();
    let created: DeliveryMapController | null = null;
    createDeliveryMap(element.current, {
      center: { lat: restaurantLat, lng: restaurantLng },
      interactive,
      signal: abort.signal,
      onPick: (point, source) => latestPick.current?.(point, source),
      onOutside: () => latestOutside.current?.(),
    })
      .then((map) => {
        if (!map) return;
        created = map;
        setController(map);
      })
      .catch(() => {
        if (!abort.signal.aborted) latestFailure.current();
      });
    return () => {
      abort.abort();
      created?.destroy();
      setController(null);
    };
    // The map is created once. Later prop changes go through the controller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  const deliveryLat = location?.lat;
  const deliveryLng = location?.lng;
  const polyline = route?.encodedPolyline ?? null;

  useEffect(() => {
    if (!controller) return;
    controller.setRestaurant({ lat: restaurantLat, lng: restaurantLng }, restaurant.name);
    controller.setDelivery(
      deliveryLat !== undefined && deliveryLng !== undefined
        ? { lat: deliveryLat, lng: deliveryLng }
        : null,
    );
    controller.setRoute(polyline);
    controller.fit();
  }, [controller, restaurantLat, restaurantLng, restaurant.name, deliveryLat, deliveryLng, polyline]);

  return (
    <div
      ref={element}
      className="map-canvas"
      aria-label={
        interactive
          ? "Delivery map. Click to set your location, then drag the pin to adjust it."
          : "Delivery route map"
      }
      role="region"
    />
  );
}
