"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RouteSteps } from "@/components/flow/RouteSteps";
import { WorkspaceSkeleton } from "@/components/flow/WorkspaceSkeleton";
import { DeliveryMap } from "@/components/maps/DeliveryMap";
import { ModelPicker, type ModelOption } from "@/components/prediction/ModelPicker";
import { OrderTimePicker } from "@/components/prediction/OrderTimePicker";
import { PredictionInputs } from "@/components/prediction/PredictionInputs";
import { PredictionIssues } from "@/components/prediction/PredictionIssues";
import { PredictionResult } from "@/components/prediction/PredictionResult";
import { Notice } from "@/components/ui/Notice";
import { useDeliveryDraft, type DeliveryDraft } from "@/hooks/use-delivery-draft";
import { useDeliveryRoute } from "@/hooks/use-delivery-route";
import { useMapEngine } from "@/hooks/use-map-engine";
import { useModelList } from "@/hooks/use-model-list";
import { usePrediction } from "@/hooks/use-prediction";
import { usePredictionPreview } from "@/hooks/use-prediction-preview";
import { useRestaurant } from "@/hooks/use-restaurants";
import { buildPredictionRequest } from "@/lib/prediction-request";
import { historyRepository } from "@/services/history/history.repository";
import { ORDER_TYPES } from "@/types/prediction";

type OrderDetails = Partial<Pick<DeliveryDraft, "orderType" | "isFestival" | "orderPlacedAt">>;

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
  const { list: modelList } = useModelList();
  const [saveState, setSaveState] = useState<"pending" | "saved" | "failed">("pending");
  const preview = usePredictionPreview(
    restaurant && location && route && routeStatus === "ready"
      ? {
          restaurant,
          location,
          route,
          orderType: draft.orderType,
          isFestival: draft.isFestival,
          orderPlacedAt: draft.orderPlacedAt,
        }
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

  // The model list comes from the API; after a prediction the result lists the same models.
  const models: ModelOption[] =
    modelList?.models.map((model) => ({
      id: model.id,
      name: model.name,
      selected: model.selected,
      unavailable: model.status === "unavailable",
    })) ??
    (state.status === "success"
      ? state.result.predictions.map((prediction) => ({
          id: prediction.model_id,
          name: prediction.model_name,
          selected: prediction.selected,
        }))
      : []);
  const defaultModelId =
    modelList?.selected_model_id ?? (state.status === "success" ? state.result.selected_model_id : "");
  const modelId = models.some((model) => model.id === draft.modelId) ? draft.modelId! : defaultModelId;
  const shown =
    state.status === "success"
      ? (state.result.predictions.find((prediction) => prediction.model_id === modelId) ??
        state.result.predictions.find((prediction) => prediction.selected) ??
        state.result.predictions[0])
      : null;

  /** A changed input makes the old result wrong, so clear it, as for order type. */
  const updateOrder = (details: OrderDetails) => {
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
      orderPlacedAt: draft.orderPlacedAt,
    });

    setSaveState("pending");
    const result = await predict(request);
    if (!result) return;
    const chosen =
      result.predictions.find((prediction) => prediction.model_id === modelId) ??
      result.predictions.find((prediction) => prediction.selected);
    if (!chosen?.predicted_delivery_time_minutes) return;

    try {
      await historyRepository.add({
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantImageUrl: restaurant.image_url,
        destination: location.address,
        distanceKm: route.distanceKm,
        mapsDurationMinutes: route.durationMinutes,
        predictedMinutes: chosen.predicted_delivery_time_minutes,
        modelStatus: result.model_status,
        modelName: result.predictions.length > 1 ? chosen.model_name : undefined,
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

      {state.status === "success" && route && shown && (
        <PredictionResult
          result={state.result}
          shown={shown}
          placedAt={state.placedAt}
          route={route}
          timeZone={restaurant.time_zone}
          saveState={saveState}
          onNewOrder={startNewOrder}
        />
      )}

      <div className="workspace">
        <div className="workspace-panel">
          <h1 className="page-heading">Predict the delivery time</h1>

          <div className="trip">
            <div className="trip-stop">
              <span className="trip-dot" aria-hidden="true" />
              <div>
                <p className="trip-label">From</p>
                <p className="trip-name">{restaurant.name}</p>
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

          <section className="inputs" aria-label="Order details">
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

            <OrderTimePicker
              value={draft.orderPlacedAt}
              timeZone={restaurant.time_zone}
              onChange={(orderPlacedAt) => updateOrder({ orderPlacedAt })}
            />

            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.isFestival}
                onChange={(event) => updateOrder({ isFestival: event.target.checked })}
              />
              During a festival
            </label>

            {/* Switching models keeps the result: every model's prediction is already loaded. */}
            <ModelPicker
              models={models}
              value={modelId}
              onChange={(next) => setOrderDetails({ modelId: next })}
            />
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
        </div>

        <div className="workspace-map">
          <DeliveryMap engine={engine} restaurant={restaurant} location={location} route={route} />
        </div>
      </div>
    </div>
  );
}
