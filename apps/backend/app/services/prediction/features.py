"""Map an API request onto the columns the trained model receives.

The model's distance input is the actual road distance from the routing
service. It is never derived from a straight line.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timezone

from app.schemas.prediction import OrderType, PredictionRequest
from app.schemas.restaurant import CityType, Restaurant
from app.services.prediction.serving import load_serving_limits

SUPPORTED_MODEL_COLUMNS = frozenset(
    {
        "Type_of_order",
        "Festival",
        "City",
        "order_hour",
        "order_day_of_week",
        "road_distance_km",
        "route_duration_minutes",
    }
)


@dataclass(frozen=True)
class DeliveryFeatures:
    """Everything a predictor may use for one order."""

    order_type: OrderType
    is_festival: bool
    city_type: CityType
    order_hour: int
    order_day_of_week: int
    road_distance_km: float
    route_duration_minutes: float | None

    def to_model_input(
        self, columns: Sequence[str] | None = None
    ) -> dict[str, str | int | float | None]:
        """Return one row using the training column names and category labels."""
        values: dict[str, str | int | float | None] = {
            "Type_of_order": self.order_type,
            "Festival": "yes" if self.is_festival else "no",
            "City": self.city_type,
            "order_hour": self.order_hour,
            "order_day_of_week": self.order_day_of_week,
            "road_distance_km": self.road_distance_km,
            "route_duration_minutes": self.route_duration_minutes,
        }
        selected = columns if columns is not None else load_serving_limits().model_features
        return {column: values[column] for column in selected}


def build_delivery_features(
    request: PredictionRequest,
    restaurant: Restaurant,
    now: datetime | None = None,
) -> DeliveryFeatures:
    """Combine a request with stored restaurant data."""
    placed_at = request.order_placed_at or now or datetime.now(timezone.utc)
    return DeliveryFeatures(
        order_type=request.order_type,
        is_festival=request.is_festival,
        city_type=restaurant.city_type,
        order_hour=placed_at.hour,
        order_day_of_week=placed_at.weekday(),
        road_distance_km=request.road_distance_km,
        route_duration_minutes=request.route_duration_minutes,
    )
