"""Check whether an order falls inside the range the model learned from."""

from app.schemas.prediction import PredictionIssue
from app.services.prediction.features import DeliveryFeatures
from app.services.prediction.serving import ServingLimits


def assess_delivery(features: DeliveryFeatures, limits: ServingLimits) -> list[PredictionIssue]:
    """Return blocking problems and accuracy warnings for one order."""
    issues: list[PredictionIssue] = []
    distance = features.road_distance_km

    if distance < limits.blocked_min_km:
        issues.append(
            PredictionIssue(
                code="distance_too_close",
                severity="blocked",
                message="This pin is at the restaurant. Move it to your delivery address.",
            )
        )
    elif distance > limits.blocked_max_km:
        issues.append(
            PredictionIssue(
                code="distance_too_far",
                severity="blocked",
                message=(
                    "This address is too far from the restaurant for a reliable estimate. "
                    "Choose a closer location."
                ),
            )
        )
    elif distance < limits.training_min_km:
        issues.append(
            PredictionIssue(
                code="distance_below_training_range",
                severity="warning",
                message=(
                    "This address is closer than the deliveries the model learned from, "
                    "so the time may be less accurate."
                ),
            )
        )
    elif distance > limits.training_max_km:
        issues.append(
            PredictionIssue(
                code="distance_above_training_range",
                severity="warning",
                message=(
                    "This address is farther than the deliveries the model learned from, "
                    "so the time may be less accurate."
                ),
            )
        )

    if features.order_hour not in limits.supported_order_hours:
        issues.append(
            PredictionIssue(
                code="order_time_outside_training_hours",
                severity="warning",
                message=(
                    "The model learned from orders placed between 8 AM and midnight, "
                    "so the time may be less accurate right now."
                ),
            )
        )
    return issues
