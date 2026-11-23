export type PredictionMode = "api" | "mock";

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
