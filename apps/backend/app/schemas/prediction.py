"""Delivery prediction API contract."""

from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

# Lowercase labels produced by the dataset cleaning step for `Type_of_order`.
OrderType = Literal["snack", "meal", "drinks", "buffet"]
ModelStatus = Literal["demo", "live"]
ModelAvailability = Literal["demo", "live", "unavailable"]
IssueSeverity = Literal["warning", "blocked"]


class PredictionRequest(BaseModel):
    """Order-time information sent by the frontend.

    `road_distance_km` is the actual distance along the road from the routing
    service. A prediction cannot be made without it.
    """

    restaurant_id: str = Field(min_length=1, max_length=64)
    restaurant_latitude: float = Field(ge=-90, le=90)
    restaurant_longitude: float = Field(ge=-180, le=180)
    delivery_latitude: float = Field(ge=-90, le=90)
    delivery_longitude: float = Field(ge=-180, le=180)
    road_distance_km: float = Field(ge=0, le=500)
    route_duration_minutes: float | None = Field(default=None, ge=0, le=1440)
    order_type: OrderType = "meal"
    is_festival: bool = False
    order_placed_at: AwareDatetime | None = Field(
        default=None,
        description="Order time with its UTC offset. The restaurant's local clock supplies order_hour.",
    )

    @model_validator(mode="after")
    def reject_null_island(self) -> "PredictionRequest":
        """Treat (0, 0) as a missing location, matching dataset cleaning."""
        if self.delivery_latitude == 0 and self.delivery_longitude == 0:
            raise ValueError("Delivery location is missing.")
        return self


class PredictionIssue(BaseModel):
    """A reason a prediction is blocked or may be less accurate."""

    code: str
    severity: IssueSeverity
    message: str


class PredictionResponse(BaseModel):
    """Predicted total delivery time and where the value came from."""

    model_config = ConfigDict(protected_namespaces=())

    predicted_delivery_time_minutes: int = Field(ge=1)
    model_status: ModelStatus
    warnings: list[PredictionIssue] = Field(default_factory=list)


class PredictionPreviewResponse(BaseModel):
    """The exact model inputs for an order, checked before predicting."""

    model_config = ConfigDict(protected_namespaces=())

    can_predict: bool
    model_input: dict[str, str | int | float | None]
    issues: list[PredictionIssue]


class ServingLimitsResponse(BaseModel):
    """Input ranges applied to live predictions."""

    training_road_distance_min_km: float
    training_road_distance_max_km: float
    blocked_road_distance_min_km: float
    blocked_road_distance_max_km: float
    supported_order_hours: list[int]


class ModelInfoResponse(BaseModel):
    """Which predictor is serving and what it expects."""

    model_config = ConfigDict(protected_namespaces=())

    model_status: ModelAvailability
    detail: str | None = None
    feature_columns: list[str]
    limits: ServingLimitsResponse
    metrics: dict[str, str | float] | None = None
