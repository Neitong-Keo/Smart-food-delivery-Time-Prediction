"""Delivery time prediction endpoints."""

import logging
from math import isfinite
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import (
    get_model_registry,
    get_predictor,
    get_restaurant_repository,
    get_serving_limits,
)
from app.repositories.restaurants import RestaurantRepository
from app.schemas.prediction import (
    ModelInfoResponse,
    ModelListResponse,
    ModelPrediction,
    ModelScores,
    ModelSummary,
    PredictionComparisonResponse,
    PredictionIssue,
    PredictionPreviewResponse,
    PredictionRequest,
    PredictionResponse,
    ServingLimitsResponse,
)
from app.services.prediction import (
    DeliveryFeatures,
    ModelRegistry,
    PredictionUnavailableError,
    Predictor,
    ServedModel,
    ServingLimits,
    UnknownModelError,
    assess_delivery,
    build_delivery_features,
    load_model_metrics,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["predictions"])

Repository = Annotated[RestaurantRepository, Depends(get_restaurant_repository)]
ConfiguredPredictor = Annotated[Predictor, Depends(get_predictor)]
Registry = Annotated[ModelRegistry, Depends(get_model_registry)]
Limits = Annotated[ServingLimits, Depends(get_serving_limits)]


def _build_features(
    payload: PredictionRequest, repository: RestaurantRepository
) -> DeliveryFeatures:
    restaurant = repository.get_restaurant(payload.restaurant_id)
    if restaurant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Restaurant not found.")
    return build_delivery_features(payload, restaurant)


def _checked_features(
    payload: PredictionRequest, repository: RestaurantRepository, limits: ServingLimits
) -> tuple[DeliveryFeatures, list[PredictionIssue]]:
    """Build the model inputs and refuse orders outside the blocked limits."""
    features = _build_features(payload, repository)
    issues = assess_delivery(features, limits)
    blocked = next((issue for issue in issues if issue.severity == "blocked"), None)
    if blocked:
        raise HTTPException(422, detail=blocked.message)
    return features, issues


def _predict_minutes(model: ServedModel, features: DeliveryFeatures) -> int:
    """Round one model's prediction to whole minutes, or raise PredictionUnavailableError."""
    minutes = float(model.predictor.predict(features))
    if not isfinite(minutes) or minutes <= 0:
        logger.error("Model %s returned an invalid value: %r", model.id, minutes)
        raise PredictionUnavailableError("The prediction service returned an invalid result.")
    return max(1, round(minutes))


def _response_status(registry: ModelRegistry) -> str:
    return "live" if registry.selected.predictor.status == "live" else "demo"


def _scores(values: dict[str, float] | None) -> ModelScores | None:
    if not values or not {"mae", "rmse", "r2"} <= set(values):
        return None
    return ModelScores(**values)


@router.post("/predict/preview", response_model=PredictionPreviewResponse)
def preview_prediction(
    payload: PredictionRequest,
    repository: Repository,
    predictor: ConfiguredPredictor,
    limits: Limits,
) -> PredictionPreviewResponse:
    """Show the exact model inputs and any range problems without predicting."""
    features = _build_features(payload, repository)
    issues = assess_delivery(features, limits)
    return PredictionPreviewResponse(
        can_predict=not any(issue.severity == "blocked" for issue in issues),
        model_input=features.to_model_input(predictor.feature_columns),
        issues=issues,
    )


@router.post("/predict", response_model=PredictionResponse)
def predict_delivery_time(
    payload: PredictionRequest,
    repository: Repository,
    registry: Registry,
    limits: Limits,
) -> PredictionResponse:
    """Predict total delivery time for one order with the chosen or selected model."""
    try:
        model = registry.get(payload.model_id)
    except UnknownModelError as error:
        raise HTTPException(422, detail=str(error)) from error
    features, issues = _checked_features(payload, repository, limits)

    try:
        minutes = _predict_minutes(model, features)
    except PredictionUnavailableError as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    return PredictionResponse(
        predicted_delivery_time_minutes=minutes,
        model_status="live" if model.predictor.status == "live" else "demo",
        model_id=model.id,
        model_name=model.name,
        warnings=issues,
    )


@router.post("/predict/compare", response_model=PredictionComparisonResponse)
def compare_predictions(
    payload: PredictionRequest,
    repository: Repository,
    registry: Registry,
    limits: Limits,
) -> PredictionComparisonResponse:
    """Predict the same order with every served model. `model_id` is ignored."""
    features, issues = _checked_features(payload, repository, limits)

    predictions = []
    for model in registry.models:
        minutes: int | None = None
        detail: str | None = None
        try:
            minutes = _predict_minutes(model, features)
        except PredictionUnavailableError as error:
            detail = str(error)
        predictions.append(
            ModelPrediction(
                model_id=model.id,
                model_name=model.name,
                selected=model.selected,
                predicted_delivery_time_minutes=minutes,
                detail=detail,
                test_mae=(model.test or {}).get("mae"),
            )
        )

    if all(prediction.predicted_delivery_time_minutes is None for prediction in predictions):
        selected = next(prediction for prediction in predictions if prediction.selected)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=selected.detail)

    return PredictionComparisonResponse(
        model_status=_response_status(registry),
        selected_model_id=registry.selected.id,
        predictions=predictions,
        warnings=issues,
    )


@router.get("/models", response_model=ModelListResponse)
def list_models(registry: Registry) -> ModelListResponse:
    """List the models the app can predict with and their recorded scores."""
    return ModelListResponse(
        selected_model_id=registry.selected.id,
        models=[
            ModelSummary(
                id=model.id,
                name=model.name,
                selected=model.selected,
                status=model.predictor.status,
                detail=model.predictor.detail,
                validation=_scores(model.validation),
                test=_scores(model.test),
            )
            for model in registry.models
        ],
    )


@router.get("/model", response_model=ModelInfoResponse)
def get_model_info(predictor: ConfiguredPredictor, limits: Limits) -> ModelInfoResponse:
    """Report which predictor is serving and the limits applied to it."""
    return ModelInfoResponse(
        model_status=predictor.status,
        detail=predictor.detail,
        feature_columns=list(predictor.feature_columns),
        limits=ServingLimitsResponse(
            training_road_distance_min_km=limits.training_min_km,
            training_road_distance_max_km=limits.training_max_km,
            blocked_road_distance_min_km=limits.blocked_min_km,
            blocked_road_distance_max_km=limits.blocked_max_km,
            supported_order_hours=sorted(limits.supported_order_hours),
        ),
        metrics=load_model_metrics() if predictor.status == "live" else None,
    )
