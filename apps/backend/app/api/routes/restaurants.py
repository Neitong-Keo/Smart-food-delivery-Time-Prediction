"""Restaurant catalog endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_restaurant_repository
from app.repositories.restaurants import RestaurantRepository
from app.schemas.restaurant import Restaurant, RestaurantListResponse

router = APIRouter(prefix="/api/restaurants", tags=["restaurants"])

Repository = Annotated[RestaurantRepository, Depends(get_restaurant_repository)]


@router.get("", response_model=RestaurantListResponse)
def list_restaurants(
    repository: Repository,
    search: Annotated[str | None, Query(max_length=80)] = None,
    cuisine: Annotated[str | None, Query(max_length=40)] = None,
) -> RestaurantListResponse:
    """List restaurants, optionally filtered by name and cuisine."""
    items = repository.list_restaurants(search=search, cuisine=cuisine)
    return RestaurantListResponse(
        items=items,
        total=len(items),
        cuisines=repository.list_cuisines(),
        data_source=repository.data_source,
    )


@router.get("/{restaurant_id}", response_model=Restaurant)
def get_restaurant(restaurant_id: str, repository: Repository) -> Restaurant:
    """Return one restaurant and its stored coordinates."""
    restaurant = repository.get_restaurant(restaurant_id)
    if restaurant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Restaurant not found.")
    return restaurant
