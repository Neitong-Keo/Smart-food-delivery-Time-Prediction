"""FastAPI dependencies for shared application services."""

from fastapi import Request

from app.repositories.restaurants import RestaurantRepository
from app.services.prediction import Predictor, ServingLimits


def get_restaurant_repository(request: Request) -> RestaurantRepository:
    return request.app.state.restaurants


def get_predictor(request: Request) -> Predictor:
    return request.app.state.predictor


def get_serving_limits(request: Request) -> ServingLimits:
    return request.app.state.serving_limits
