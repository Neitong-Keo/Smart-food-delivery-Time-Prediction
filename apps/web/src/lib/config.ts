export type PredictionMode = "api" | "mock";

/**
 * [west, south, east, north]. The Bengaluru delivery area from the dataset, with a small margin.
 * The dataset's 3,171 Bengaluru orders deliver between latitude 12.916–13.159 and
 * longitude 77.581–77.829. The map, address search and pins stay inside this box.
 */
export const DELIVERY_AREA_BOUNDS: [number, number, number, number] = [77.53, 12.87, 77.88, 13.21];
export const DELIVERY_AREA_NAME = "Bengaluru";

/** Zoomed out any further, the delivery area would only fill part of the map. */
export const DELIVERY_MAP_MIN_ZOOM = 11;

export function isInDeliveryArea({ lat, lng }: { lat: number; lng: number }): boolean {
  const [west, south, east, north] = DELIVERY_AREA_BOUNDS;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

const DEFAULT_API_BASE_URL = "http://localhost:8600";

const predictionMode: PredictionMode =
  process.env.NEXT_PUBLIC_PREDICTION_MODE?.trim().toLowerCase() === "mock" ? "mock" : "api";

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export const config = {
  apiBaseUrl: withoutTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL),
  mapStyleLightUrl:
    process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT_URL?.trim() || "https://tiles.openfreemap.org/styles/positron",
  mapStyleDarkUrl:
    process.env.NEXT_PUBLIC_MAP_STYLE_DARK_URL?.trim() || "https://tiles.openfreemap.org/styles/dark",
  geocodingUrl: withoutTrailingSlash(
    process.env.NEXT_PUBLIC_GEOCODING_URL?.trim() || "https://photon.komoot.io",
  ),
  routingUrl: withoutTrailingSlash(
    process.env.NEXT_PUBLIC_ROUTING_URL?.trim() || "https://router.project-osrm.org",
  ),
  predictionMode,
  apiTimeoutMs: 10_000,
  mapsTimeoutMs: 12_000,
} as const;
