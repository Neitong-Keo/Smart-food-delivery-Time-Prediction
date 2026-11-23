import type { LatLng } from "@/types/location";

/** Sample drop-off areas offered only when the map cannot load. */
export const DEMO_DELIVERY_AREAS: ReadonlyArray<LatLng & { id: string; name: string }> = [
  { id: "central-market", name: "Central Market, Daun Penh", lat: 11.5696, lng: 104.9211 },
  { id: "independence", name: "Independence Monument", lat: 11.5564, lng: 104.9282 },
  { id: "russian-market", name: "Russian Market, Toul Tom Poung", lat: 11.5395, lng: 104.9165 },
  { id: "toul-kork", name: "Toul Kork", lat: 11.5812, lng: 104.9023 },
  { id: "chroy-changvar", name: "Chroy Changvar", lat: 11.5986, lng: 104.9362 },
  { id: "sen-sok", name: "Sen Sok", lat: 11.5902, lng: 104.8815 },
];
