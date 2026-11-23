import { House, Utensils } from "lucide-react";

import type { LatLng } from "@/types/location";

const GRID_LINES = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const PADDING = 0.22;

function project(point: LatLng, others: LatLng[]) {
  const lats = others.map((item) => item.lat);
  const lngs = others.map((item) => item.lng);
  const minLat = Math.min(...lats);
  const minLng = Math.min(...lngs);
  const span = Math.max(Math.max(...lats) - minLat, Math.max(...lngs) - minLng, 0.004);
  const centerLat = (minLat + Math.max(...lats)) / 2;
  const centerLng = (minLng + Math.max(...lngs)) / 2;
  const scale = 1 - PADDING * 2;
  return {
    x: 50 + ((point.lng - centerLng) / span) * scale * 100,
    y: 50 - ((point.lat - centerLat) / span) * scale * 100,
  };
}

/** Offline stand-in for the map. It shows relative position, not streets. */
export function SchematicMap({ origin, destination }: { origin: LatLng; destination: LatLng | null }) {
  const points = destination ? [origin, destination] : [origin];
  const start = project(origin, points);
  const end = destination ? project(destination, points) : null;

  return (
    <div
      className="schematic"
      role="img"
      aria-label={
        destination
          ? "Simplified view of the restaurant and delivery location"
          : "Simplified view of the restaurant location"
      }
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {GRID_LINES.map((line) => (
          <g key={line} className="schematic-grid" vectorEffect="non-scaling-stroke">
            <line x1={line} y1={0} x2={line} y2={100} vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={line} x2={100} y2={line} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {end && (
          <line
            className="schematic-line"
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <span className="schematic-pin" style={{ left: `${start.x}%`, top: `${start.y}%` }}>
        <span className="map-pin map-pin-restaurant">
          <Utensils size={17} aria-hidden />
        </span>
      </span>
      {end && (
        <span className="schematic-pin" style={{ left: `${end.x}%`, top: `${end.y}%` }}>
          <span className="map-pin map-pin-delivery">
            <House size={17} aria-hidden />
          </span>
        </span>
      )}
      <p className="schematic-caption">
        Simplified view. Streets aren&apos;t shown because the map couldn&apos;t load.
      </p>
    </div>
  );
}
