import type { LatLng } from "@/types/location";

/** Sample drop-off areas offered only when the map cannot load. */
export const DEMO_DELIVERY_AREAS: ReadonlyArray<LatLng & { id: string; name: string }> = [
  { id: "dataset-drop-off", name: "Bengaluru dataset drop-off", lat: 12.992532, lng: 77.628179 },
  { id: "cubbon-park", name: "Cubbon Park", lat: 12.97575, lng: 77.59265 },
  { id: "indiranagar", name: "Indiranagar", lat: 12.97832, lng: 77.64081 },
  { id: "koramangala", name: "Koramangala", lat: 12.93519, lng: 77.62448 },
  { id: "jayanagar", name: "Jayanagar", lat: 12.92953, lng: 77.58334 },
  { id: "malleshwaram", name: "Malleshwaram", lat: 13.00384, lng: 77.57122 },
];
