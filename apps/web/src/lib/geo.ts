import type { LatLng } from "@/types/location";

export function isValidLatLng(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180 &&
    !(point.lat === 0 && point.lng === 0)
  );
}

/** Decode an encoded polyline (precision 5, as returned by OSRM) into coordinates. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const readDelta = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += readDelta();
    lng += readDelta();
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export function routeKey(restaurantId: string, destination: LatLng): string {
  return `${restaurantId}:${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;
}
