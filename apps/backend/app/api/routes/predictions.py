"""Delivery time prediction endpoints."""

import logging
from math import isfinite
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_predictor, get_restaurant_repository, get_serving_limits
from app.repositories.restaurants import RestaurantRepository
from app.schemas.prediction import (
    ModelInfoResponse,
    PredictionPreviewResponse,
    PredictionRequest,
    PredictionResponse,
    ServingLimitsResponse,
)
from app.services.prediction import (
    DeliveryFeatures,
    PredictionUnavailableError,
    Predictor,
    ServingLimits,
    assess_delivery,
    build_delivery_features,
    load_model_metrics,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["predictions"])

Repository = Annotated[RestaurantRepository, Depends(get_restaurant_repository)]
ConfiguredPredictor = Annotated[Predictor, Depends(get_predictor)]
Limits = Annotated[ServingLimits, Depends(get_serving_limits)]


def _build_features(
    payload: PredictionRequest, repository: RestaurantRepository
) -> DeliveryFeatures:
    restaurant = repository.get_restaurant(payload.restaurant_id)
    if restaurant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Restaurant not found.")
    return build_delivery_features(payload, restaurant)


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
    predictor: ConfiguredPredictor,
    limits: Limits,
) -> PredictionResponse:
    """Predict total delivery time for one order."""
    features = _build_features(payload, repository)
    issues = assess_delivery(features, limits)
    blocked = next((issue for issue in issues if issue.severity == "blocked"), None)
    if blocked:
        raise HTTPException(422, detail=blocked.message)

    try:
        minutes = float(predictor.predict(features))
    except PredictionUnavailableError as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    if not isfinite(minutes) or minutes <= 0:
        logger.error("Predictor returned an invalid value: %r", minutes)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The prediction service returned an invalid result.",
        )

    return PredictionResponse(
        predicted_delivery_time_minutes=max(1, round(minutes)),
        model_status="live" if predictor.status == "live" else "demo",
        warnings=issues,
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
