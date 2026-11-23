"""Restaurant storage.

`SampleRestaurantRepository` is temporary. To use a real database, implement
`RestaurantRepository` and assign it to `application.state.restaurants` in
`app/main.py`. Routes depend only on the protocol.
"""

import json
from pathlib import Path
from typing import Literal, Protocol

from app.schemas.restaurant import Restaurant

SAMPLE_RESTAURANTS_PATH = Path(__file__).resolve().parents[1] / "data" / "sample_restaurants.json"


class RestaurantRepository(Protocol):
    """Read access to the restaurant catalog."""

    data_source: Literal["sample", "database"]

    def list_restaurants(
        self, search: str | None = None, cuisine: str | None = None
    ) -> list[Restaurant]: ...

    def get_restaurant(self, restaurant_id: str) -> Restaurant | None: ...

    def list_cuisines(self) -> list[str]: ...


class SampleRestaurantRepository:
    """Serve a fictional catalog from a JSON file."""

    data_source: Literal["sample"] = "sample"

    def __init__(self, path: Path = SAMPLE_RESTAURANTS_PATH) -> None:
        records = json.loads(path.read_text(encoding="utf-8"))
        self._restaurants = [Restaurant.model_validate(record) for record in records]
        self._by_id = {restaurant.id: restaurant for restaurant in self._restaurants}

    def list_restaurants(
        self, search: str | None = None, cuisine: str | None = None
    ) -> list[Restaurant]:
        """Filter by case-insensitive name fragment and exact cuisine."""
        name_query = (search or "").strip().casefold()
        cuisine_query = (cuisine or "").strip().casefold()
        return [
            restaurant
            for restaurant in self._restaurants
            if name_query in restaurant.name.casefold()
            and (not cuisine_query or (restaurant.cuisine or "").casefold() == cuisine_query)
        ]

    def get_restaurant(self, restaurant_id: str) -> Restaurant | None:
        return self._by_id.get(restaurant_id)

    def list_cuisines(self) -> list[str]:
        return sorted({r.cuisine for r in self._restaurants if r.cuisine})
