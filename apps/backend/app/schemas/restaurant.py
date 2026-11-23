"""Restaurant API schemas."""

from typing import Literal

from pydantic import BaseModel, Field

# Labels produced by the dataset cleaning step for the model's `City` feature.
CityType = Literal["Metropolitan", "Urban", "Semi-Urban"]


class Restaurant(BaseModel):
    """A restaurant and the stored coordinates used as the delivery origin."""

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    address: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    cuisine: str | None = None
    rating: float | None = Field(default=None, ge=0, le=5)
    image_url: str | None = None
    city_type: CityType


class RestaurantListResponse(BaseModel):
    """Restaurants matching a query, plus the full catalog's cuisine filters."""

    items: list[Restaurant]
    total: int
    cuisines: list[str]
    data_source: Literal["sample", "database"]
