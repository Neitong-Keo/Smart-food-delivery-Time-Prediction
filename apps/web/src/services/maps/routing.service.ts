import { config } from "@/lib/config";
import { fetchJson } from "@/services/maps/fetch-json";
import type { LatLng, RouteSummary } from "@/types/location";

// Keep in step with serving.max_point_to_road_m in ml/configs/dataset.yaml.
const MAX_POINT_TO_ROAD_M = 500;

interface OsrmRoute {
  distance?: number;
  duration?: number;
  geometry?: string;
  legs?: Array<{ steps?: Array<{ mode?: string }> }>;
}

interface OsrmResponse {
  code?: string;
  routes?: OsrmRoute[];
  waypoints?: Array<{ distance?: number }>;
}

/** A route problem with a message that tells the customer what to do. */
export class RouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteError";
  }
}

const usesFerry = (route: OsrmRoute) =>
  route.legs?.some((leg) => leg.steps?.some((step) => step.mode === "ferry")) ?? false;

/**
 * Request the actual road route from OSRM. Durations do not include live traffic.
 * The public server can't exclude ferries, so alternatives are checked instead.
 * The training data uses the same route selection in ml/routes.py.
 */
export async function computeRoadRoute(
  key: string,
  origin: LatLng,
  destination: LatLng,
  signal?: AbortSignal,
): Promise<RouteSummary> {
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const payload = await fetchJson<OsrmResponse>(
    `${config.routingUrl}/route/v1/driving/${coordinates}?overview=full&geometries=polyline&alternatives=true&steps=true`,
    signal,
  );
  const route = payload.routes?.find((candidate) => !usesFerry(candidate)) ?? payload.routes?.[0];
  if (
    payload.code !== "Ok" ||
    typeof route?.distance !== "number" ||
    typeof route.duration !== "number"
  ) {
    throw new RouteError("No road route was found to this location. Move the pin to a nearby street.");
  }
  if (Math.max(...(payload.waypoints ?? []).map((point) => point.distance ?? 0)) > MAX_POINT_TO_ROAD_M) {
    throw new RouteError("This pin is too far from a road. Move it closer to the street.");
  }
  return {
    key,
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,
    encodedPolyline: route.geometry ?? null,
  };
}
