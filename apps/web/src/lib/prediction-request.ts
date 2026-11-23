import { toLocalIsoString } from "@/lib/format";
import type { DeliveryLocation, RouteSummary } from "@/types/location";
import type { OrderType, PredictionRequest } from "@/types/prediction";
import type { Restaurant } from "@/types/restaurant";

export interface PredictionInput {
  restaurant: Restaurant;
  location: DeliveryLocation;
  route: RouteSummary;
  orderType: OrderType;
  isFestival: boolean;
}

export function buildPredictionRequest(
  { restaurant, location, route, orderType, isFestival }: PredictionInput,
  placedAt: Date = new Date(),
): PredictionRequest {
  return {
    restaurant_id: restaurant.id,
    restaurant_latitude: restaurant.latitude,
    restaurant_longitude: restaurant.longitude,
    delivery_latitude: location.lat,
    delivery_longitude: location.lng,
    road_distance_km: route.distanceKm,
    route_duration_minutes: route.durationMinutes,
    order_type: orderType,
    is_festival: isFestival,
    order_placed_at: toLocalIsoString(placedAt),
  };
}
