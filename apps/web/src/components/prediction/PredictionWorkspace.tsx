"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RouteSteps } from "@/components/flow/RouteSteps";
import { WorkspaceSkeleton } from "@/components/flow/WorkspaceSkeleton";
import { DeliveryMap } from "@/components/maps/DeliveryMap";
import { PredictionInputs } from "@/components/prediction/PredictionInputs";
import { PredictionIssues } from "@/components/prediction/PredictionIssues";
import { PredictionResult } from "@/components/prediction/PredictionResult";
import { Notice } from "@/components/ui/Notice";
import { useDeliveryDraft } from "@/hooks/use-delivery-draft";
import { useDeliveryRoute } from "@/hooks/use-delivery-route";
import { useMapEngine } from "@/hooks/use-map-engine";
import { usePrediction } from "@/hooks/use-prediction";
import { usePredictionPreview } from "@/hooks/use-prediction-preview";
import { useRestaurant } from "@/hooks/use-restaurants";
import { formatCoordinates } from "@/lib/format";
import { buildPredictionRequest } from "@/lib/prediction-request";
import { historyRepository } from "@/services/history/history.repository";
import { ORDER_TYPES, type OrderType } from "@/types/prediction";

export function PredictionWorkspace() {
  const router = useRouter();
  const { draft, isHydrated, setOrderDetails, resetDraft } = useDeliveryDraft();
  const { restaurant, status, error, retry } = useRestaurant(isHydrated ? draft.restaurantId : null);
  const engine = useMapEngine();
  const { location } = draft;
  const {
    route,
    status: routeStatus,
    warning,
    retry: retryRoute,
  } = useDeliveryRoute(restaurant, location);
  const { state, predict, reset } = usePrediction();
  const [saveState, setSaveState] = useState<"pending" | "saved" | "failed">("pending");
  const preview = usePredictionPreview(
    restaurant && location && route && routeStatus === "ready"
      ? { restaurant, location, route, orderType: draft.orderType, isFestival: draft.isFestival }
      : null,
  );

  if (!isHydrated || (draft.restaurantId && status === "loading")) {
    return (
      <div className="container page">
        <RouteSteps current="prediction" />
        <WorkspaceSkeleton />
      </div>
    );
  }

  if (!draft.restaurantId || !location) {
    const needsRestaurant = !draft.restaurantId;
    return (
      <div className="container page">
        <RouteSteps current="prediction" />
        <div className="empty-state">
          <h1 className="page-heading">
            {needsRestaurant ? "Choose a restaurant first" : "Set a delivery location first"}
          </h1>
          <p>A delivery time needs both ends of the route.</p>
          <Link href={needsRestaurant ? "/restaurants" : "/delivery"} className="button button-primary">
            {needsRestaurant ? "Browse restaurants" : "Set delivery location"}
          </Link>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="container page">
        <RouteSteps current="prediction" />
        <Notice
          tone="error"
          title="This restaurant couldn't be loaded"
          action={
            <button type="button" className="button button-secondary" onClick={retry}>
              Try again
            </button>
          }
        >
          {error}
        </Notice>
      </div>
    );
  }

  const updateOrder = (details: { orderType?: OrderType; isFestival?: boolean }) => {
    setOrderDetails(details);
    reset();
  };

  const handlePredict = async () => {
    if (!route) return;
    const request = buildPredictionRequest({
      restaurant,
      location,
      route,
      orderType: draft.orderType,
      isFestival: draft.isFestival,
    });

    setSaveState("pending");
    const result = await predict(request);
    if (!result) return;

    try {
      await historyRepository.add({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantImageUrl: restaurant.image_url,
        destination: location.address,
        distanceKm: route.distanceKm,
        mapsDurationMinutes: route.durationMinutes,
        predictedMinutes: result.predicted_delivery_time_minutes,
        modelStatus: result.model_status,
        outsideTrainingRange: result.warnings.length > 0,
      });
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  };

  const startNewOrder = () => {
    resetDraft();
    router.push("/restaurants");
  };

  const isPredicting = state.status === "loading";
  const routeReady = routeStatus === "ready" && route !== null;
  const isBlocked = preview?.can_predict === false;

  return (
    <div className="container page">
      <RouteSteps current="prediction" />

      {state.status === "success" && route && (
        <PredictionResult
          result={state.result}
          requestedAt={state.requestedAt}
          route={route}
          timeZone={restaurant.time_zone}
          saveState={saveState}
          onNewOrder={startNewOrder}
        />
      )}

      <div className="workspace">
        <div className="workspace-panel">
          <h1 className="page-heading">Review your delivery</h1>

          <div className="trip">
            <div className="trip-stop">
              <span className="trip-dot" aria-hidden="true" />
              <div>
                <p className="trip-label">From</p>
                <p className="trip-name">{restaurant.name}</p>
                <p className="trip-address">{restaurant.address}</p>
              </div>
            </div>
            <div className="trip-stop">
              <span className="trip-dot" aria-hidden="true" />
              <div>
                <p className="trip-label">To</p>
                <p className="trip-name">{location.address}</p>
                <Link href="/delivery" className="text-link">
                  Change location
                </Link>
              </div>
            </div>
          </div>

          <hr className="section-divider" />

          <section className="inputs" aria-labelledby="inputs-title">
            <h2 id="inputs-title" className="inputs-title">
              What the prediction uses
            </h2>

            {route && routeStatus === "ready" && <PredictionInputs preview={preview} route={route} />}
            {routeStatus === "loading" && (
              <div className="skeleton" role="status" aria-label="Calculating route" style={{ height: "5rem" }} />
            )}

            {warning && (
              <Notice
                tone="warning"
                title="A road route is needed to predict"
                action={
                  <span style={{ display: "inline-flex", gap: "var(--space-2)" }}>
                    <button type="button" className="button button-secondary" onClick={retryRoute}>
                      Try again
                    </button>
                    <Link href="/delivery" className="button button-ghost">
                      Change location
                    </Link>
                  </span>
                }
              >
                {warning}
              </Notice>
            )}

            <fieldset className="order-type-group">
              <legend>Order type</legend>
              <div className="segmented">
                {ORDER_TYPES.map((type) => (
                  <label key={type.value} className="segment">
                    <input
                      type="radio"
                      name="order-type"
                      value={type.value}
                      checked={draft.orderType === type.value}
                      onChange={() => updateOrder({ orderType: type.value })}
                    />
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.isFestival}
                onChange={(event) => updateOrder({ isFestival: event.target.checked })}
              />
              Ordering during a festival or public holiday
            </label>
          </section>

          {preview && <PredictionIssues issues={preview.issues} />}

          {state.status === "error" && (
            <Notice tone="error" title="The delivery time couldn't be predicted">
              {state.message}
            </Notice>
          )}

          {isBlocked ? (
            <Link href="/delivery" className="button button-primary button-lg button-block">
              Change delivery location
            </Link>
          ) : (
            <button
              type="button"
              className="button button-primary button-lg button-block"
              onClick={() => void handlePredict()}
              disabled={isPredicting || !routeReady}
            >
              {isPredicting && <Loader2 className="spin" size={18} aria-hidden />}
              {isPredicting
                ? "Predicting delivery time"
                : state.status === "error"
                  ? "Try again"
                  : state.status === "success"
                    ? "Predict again"
                    : "Predict delivery time"}
            </button>
          )}

          <details className="technical-details">
            <summary>Technical details</summary>
            <dl className="technical-list">
              <div>
                <dt>Restaurant coordinates</dt>
                <dd>{formatCoordinates(restaurant.latitude, restaurant.longitude)}</dd>
              </div>
              <div>
                <dt>Delivery coordinates</dt>
                <dd>{formatCoordinates(location.lat, location.lng)}</dd>
              </div>
              <div>
                <dt>Route source</dt>
                <dd>{route ? "OSRM road route" : "Unavailable"}</dd>
              </div>
            </dl>
          </details>
        </div>

        <div className="workspace-map">
          <DeliveryMap engine={engine} restaurant={restaurant} location={location} route={route} />
        </div>
      </div>
    </div>
  );
}
