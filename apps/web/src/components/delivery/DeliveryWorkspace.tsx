"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

import { RouteSteps } from "@/components/flow/RouteSteps";
import { WorkspaceSkeleton } from "@/components/flow/WorkspaceSkeleton";
import { DeliveryMap } from "@/components/maps/DeliveryMap";
import { ManualLocation } from "@/components/maps/ManualLocation";
import { MapStatusNotice } from "@/components/maps/MapStatusNotice";
import { PlaceSearch } from "@/components/maps/PlaceSearch";
import { RouteFigures } from "@/components/maps/RouteFigures";
import { PredictionIssues } from "@/components/prediction/PredictionIssues";
import { RestaurantImage } from "@/components/restaurants/RestaurantImage";
import { Notice } from "@/components/ui/Notice";
import { useDeliveryDraft } from "@/hooks/use-delivery-draft";
import { useDeliveryLocation } from "@/hooks/use-delivery-location";
import { useDeliveryRoute } from "@/hooks/use-delivery-route";
import { useMapEngine } from "@/hooks/use-map-engine";
import { usePredictionPreview } from "@/hooks/use-prediction-preview";
import { useRestaurant } from "@/hooks/use-restaurants";
import { DELIVERY_AREA_NAME } from "@/lib/config";

export function DeliveryWorkspace() {
  const params = useSearchParams();
  const requestedId = params.get("restaurant");
  const { draft, isHydrated, selectRestaurant } = useDeliveryDraft();
  const restaurantId = requestedId ?? draft.restaurantId;
  const { restaurant, status, error, retry } = useRestaurant(isHydrated ? restaurantId : null);
  const engine = useMapEngine();
  const mapReady = engine.status === "ready";
  const delivery = useDeliveryLocation();
  const {
    route,
    status: routeStatus,
    warning,
    retry: retryRoute,
  } = useDeliveryRoute(restaurant, delivery.location);
  const { pickPoint, setError, reportOutside } = delivery;
  const preview = usePredictionPreview(
    restaurant && delivery.location && route && routeStatus === "ready"
      ? {
          restaurant,
          location: delivery.location,
          route,
          orderType: draft.orderType,
          isFestival: draft.isFestival,
          orderPlacedAt: draft.orderPlacedAt,
        }
      : null,
  );

  useEffect(() => {
    if (restaurant) selectRestaurant(restaurant.id);
  }, [restaurant, selectRestaurant]);

  const handleMapPick = useCallback(
    (point: { lat: number; lng: number }, source: "map" | "drag") => void pickPoint(point, source),
    [pickPoint],
  );

  if (!isHydrated || (restaurantId && status === "loading")) {
    return (
      <div className="container page">
        <RouteSteps current="location" />
        <WorkspaceSkeleton />
      </div>
    );
  }

  if (!restaurantId) {
    return (
      <div className="container page">
        <RouteSteps current="location" />
        <div className="empty-state">
          <h1 className="page-heading">Choose a restaurant first</h1>
          <p>Your delivery route starts from the restaurant you pick.</p>
          <Link href="/restaurants" className="button button-primary">
            Browse restaurants
          </Link>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="container page">
        <RouteSteps current="location" />
        <Notice
          tone="error"
          title="This restaurant couldn't be loaded"
          action={
            <span style={{ display: "inline-flex", gap: "var(--space-2)" }}>
              <button type="button" className="button button-secondary" onClick={retry}>
                Try again
              </button>
              <Link href="/restaurants" className="button button-ghost">
                Browse restaurants
              </Link>
            </span>
          }
        >
          {error}
        </Notice>
      </div>
    );
  }

  const near = { lat: restaurant.latitude, lng: restaurant.longitude };
  const isBlocked = preview?.can_predict === false;
  const canContinue = Boolean(delivery.location && route && routeStatus === "ready" && !isBlocked);

  return (
    <div className="container page">
      <RouteSteps current="location" />

      <div className="workspace">
        <div className="workspace-panel">
          <h1 className="page-heading">Where should we deliver?</h1>

          <div className="origin-row">
            <RestaurantImage src={restaurant.image_url} alt="" className="origin-photo" size={56} />
            <div className="origin-copy">
              <p className="origin-label">Delivering from</p>
              <p className="origin-name">{restaurant.name}</p>
              <p className="origin-address">{restaurant.address}</p>
            </div>
            <Link href="/restaurants" className="text-link">
              Change
            </Link>
          </div>

          <MapStatusNotice engine={engine} />

          <PlaceSearch near={near} onSelect={delivery.pickResolved} onError={setError} />
          {engine.status === "unavailable" && <ManualLocation onPick={pickPoint} />}

          {mapReady && !delivery.location && (
            <p className="map-hint">
              Or click the map to drop a pin. The demo covers {DELIVERY_AREA_NAME}, where the
              model&apos;s orders were delivered.
            </p>
          )}

          {delivery.error && <Notice tone="warning">{delivery.error}</Notice>}
          {warning && (
            <Notice
              tone="warning"
              action={
                <button type="button" className="button button-secondary" onClick={retryRoute}>
                  Try again
                </button>
              }
            >
              {warning}
            </Notice>
          )}

          {delivery.location && (
            <div className="destination">
              <MapPin size={18} aria-hidden />
              <div>
                <p className="destination-label">
                  {delivery.isResolving ? "Finding the address" : "Delivering to"}
                </p>
                <p className="destination-address">{delivery.location.address}</p>
              </div>
            </div>
          )}

          {mapReady && delivery.location && (
            <p className="map-hint">Not quite right? Drag the pin to your door.</p>
          )}

          <RouteFigures route={route} status={routeStatus} />

          {preview && <PredictionIssues issues={preview.issues} />}

          {canContinue ? (
            <Link href="/predict" className="button button-primary button-lg button-block">
              Confirm delivery location
            </Link>
          ) : (
            <button
              type="button"
              className="button button-primary button-lg button-block"
              disabled
            >
              {isBlocked
                ? "Choose a different location"
                : routeStatus === "error"
                  ? "A road route is needed"
                  : delivery.location
                    ? "Calculating route"
                    : "Set a location to continue"}
            </button>
          )}
        </div>

        <div className="workspace-map">
          <DeliveryMap
            engine={engine}
            restaurant={restaurant}
            location={delivery.location}
            route={route}
            interactive
            onPick={handleMapPick}
            onOutside={reportOutside}
          />
        </div>
      </div>
    </div>
  );
}
