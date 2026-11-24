"""FastAPI dependencies for shared application services."""

from fastapi import Request

from app.repositories.restaurants import RestaurantRepository
from app.services.dataset import DatasetTables
from app.services.prediction import ModelRegistry, Predictor, ServingLimits


def get_restaurant_repository(request: Request) -> RestaurantRepository:
    return request.app.state.restaurants


def get_predictor(request: Request) -> Predictor:
    return request.app.state.predictor


def get_model_registry(request: Request) -> ModelRegistry:
    return request.app.state.models


def get_serving_limits(request: Request) -> ServingLimits:
    return request.app.state.serving_limits


def get_dataset_tables(request: Request) -> DatasetTables:
    return request.app.state.datasets
