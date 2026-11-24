import { DELIVERY_AREA_BOUNDS, config, isInDeliveryArea } from "@/lib/config";
import { fetchJson } from "@/services/maps/fetch-json";
import type { LatLng, PlaceSuggestion } from "@/types/location";

const RESULT_LIMIT = 6;

interface PhotonProperties {
  osm_type?: string;
  osm_id?: number;
  name?: string;
  housenumber?: string;
  street?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface PhotonResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: PhotonProperties;
  }>;
}

function describePlace(properties: PhotonProperties) {
  const streetLine = [properties.housenumber, properties.street].filter(Boolean).join(" ");
  const primary =
    properties.name || streetLine || properties.district || properties.city || "Selected location";
  const parts = [streetLine, properties.district, properties.city, properties.state];
  const secondary = parts
    .filter((part, index): part is string => Boolean(part) && part !== primary && parts.indexOf(part) === index)
    .join(", ");
  return { primary, secondary };
}

export async function searchPlaces(
  query: string,
  near: LatLng,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  // Photon's bbox is minLon,minLat,maxLon,maxLat, the same order as DELIVERY_AREA_BOUNDS.
  const bbox = DELIVERY_AREA_BOUNDS.join(",");
  const params = new URLSearchParams({
    q: query,
    lat: String(near.lat),
    lon: String(near.lng),
    bbox,
    limit: String(RESULT_LIMIT),
    lang: "en",
  });
  const { features = [] } = await fetchJson<PhotonResponse>(
    `${config.geocodingUrl}/api/?${params}`,
    signal,
  );

  return features.flatMap((feature, index) => {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || !isInDeliveryArea({ lat: coordinates[1], lng: coordinates[0] })) return [];
    const properties = feature.properties ?? {};
    return [
      {
        id: `${properties.osm_type ?? "place"}-${properties.osm_id ?? index}`,
        lat: coordinates[1],
        lng: coordinates[0],
        ...describePlace(properties),
      },
    ];
  });
}

export function formatSuggestion({ primary, secondary }: PlaceSuggestion): string {
  return secondary ? `${primary}, ${secondary}` : primary;
}

export async function reverseGeocode(point: LatLng, signal?: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(point.lat),
    lon: String(point.lng),
    limit: "1",
    lang: "en",
  });
  const { features = [] } = await fetchJson<PhotonResponse>(
    `${config.geocodingUrl}/reverse?${params}`,
    signal,
  );
  const properties = features[0]?.properties;
  if (!properties) return null;
  const { primary, secondary } = describePlace(properties);
  return secondary ? `${primary}, ${secondary}` : primary;
}
