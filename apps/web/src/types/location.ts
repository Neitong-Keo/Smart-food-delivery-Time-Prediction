export interface LatLng {
  lat: number;
  lng: number;
}

export type LocationSource = "search" | "map" | "drag" | "geolocation" | "preset" | "coordinates";

export interface DeliveryLocation extends LatLng {
  address: string;
  source: LocationSource;
}

/** An actual road route from the routing service. */
export interface RouteSummary {
  key: string;
  distanceKm: number;
  durationMinutes: number;
  encodedPolyline: string | null;
}

export interface PlaceSuggestion extends LatLng {
  id: string;
  primary: string;
  secondary: string;
}
