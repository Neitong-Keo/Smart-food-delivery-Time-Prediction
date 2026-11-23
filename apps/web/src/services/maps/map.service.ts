import type { GeoJSONSource, StyleSpecification } from "maplibre-gl";

import { config } from "@/lib/config";
import { decodePolyline } from "@/lib/geo";
import { fetchJson } from "@/services/maps/fetch-json";
import type { LatLng } from "@/types/location";

export type MapFailure = "webgl" | "load";

export class MapUnavailableError extends Error {
  constructor(readonly reason: MapFailure) {
    super(reason === "webgl" ? "This browser can't display the map." : "The map couldn't be loaded.");
    this.name = "MapUnavailableError";
  }
}

type MapLibre = typeof import("maplibre-gl");

const ROUTE_SOURCE = "delivery-route";
const ROUTE_CASING_LAYER = "delivery-route-casing";
const ROUTE_LINE_LAYER = "delivery-route-line";

const STYLE_TINTS = {
  light: { background: "#f7f5f0", water: "#d9e1df", park: "#e3e6d6", building: "#ece9e2" },
  dark: { background: "#1f1e1c", water: "#2c3534", landuse_park: "#2a2f25", building: "#2a2826" },
} as const;

let enginePromise: Promise<MapLibre> | null = null;
const stylePromises: Partial<Record<"light" | "dark", Promise<StyleSpecification>>> = {};

function supportsWebGL(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

function loadEngine(): Promise<MapLibre> {
  if (!supportsWebGL()) return Promise.reject(new MapUnavailableError("webgl"));
  enginePromise ??= import("maplibre-gl")
    .then((maplibre) => {
      // MapLibre 6 ships its worker separately. Webpack emits this file as a static asset.
      maplibre.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
      return maplibre;
    })
    .catch(() => {
      enginePromise = null;
      throw new MapUnavailableError("load");
    });
  return enginePromise;
}

/** Fetch an OpenFreeMap style and warm its colors to match the app palette. */
function loadStyle(theme: "light" | "dark"): Promise<StyleSpecification> {
  stylePromises[theme] ??= fetchJson<StyleSpecification>(
    theme === "dark" ? config.mapStyleDarkUrl : config.mapStyleLightUrl,
  )
    .then((style) => {
      const tints: Record<string, string> = STYLE_TINTS[theme];
      return {
        ...style,
        layers: style.layers.map((layer) => {
          const color = tints[layer.id];
          if (!color || (layer.type !== "background" && layer.type !== "fill")) return layer;
          const property = layer.type === "background" ? "background-color" : "fill-color";
          return { ...layer, paint: { ...layer.paint, [property]: color } } as typeof layer;
        }),
      };
    })
    .catch(() => {
      delete stylePromises[theme];
      throw new MapUnavailableError("load");
    });
  return stylePromises[theme];
}

const currentTheme = (): "light" | "dark" =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

/** Load the map library and current style, rejecting with MapUnavailableError. */
export async function prepareMap(): Promise<void> {
  await Promise.all([loadEngine(), loadStyle(currentTheme())]);
}

export interface DeliveryMapController {
  setRestaurant(point: LatLng, title: string): void;
  setDelivery(point: LatLng | null): void;
  setRoute(encodedPolyline: string | null): void;
  fit(): void;
  destroy(): void;
}

interface DeliveryMapOptions {
  center: LatLng;
  interactive: boolean;
  signal: AbortSignal;
  onPick: (point: LatLng, source: "map" | "drag") => void;
}

const PIN_ICONS = {
  restaurant:
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  delivery:
    '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6a2 2 0 0 1 .7 1.5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
} as const;

/** MapLibre positions the outer element with a transform, so hover styles go on the inner pin. */
function createPin(kind: keyof typeof PIN_ICONS, label: string): HTMLElement {
  const marker = document.createElement("div");
  marker.className = "map-marker";
  marker.title = label;
  marker.innerHTML = `<div class="map-pin map-pin-${kind}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PIN_ICONS[kind]}</svg></div>`;
  return marker;
}

const routeGeometry = (path: LatLng[]): GeoJSON.Feature<GeoJSON.LineString> => ({
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: path.map(({ lat, lng }) => [lng, lat]) },
});

/** Create a map and return a small controller, keeping MapLibre objects out of React. */
export async function createDeliveryMap(
  element: HTMLElement,
  { center, interactive, signal, onPick }: DeliveryMapOptions,
): Promise<DeliveryMapController | null> {
  const [maplibre, style] = await Promise.all([loadEngine(), loadStyle(currentTheme())]);
  if (signal.aborted) return null;

  const map = new maplibre.Map({
    container: element,
    style,
    center: [center.lng, center.lat],
    zoom: 13.5,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    cooperativeGestures: !interactive,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

  const restaurantMarker = new maplibre.Marker({ element: createPin("restaurant", "Restaurant") });
  const deliveryMarker = new maplibre.Marker({
    element: createPin("delivery", interactive ? "Delivery location. Drag to adjust." : "Delivery location"),
    draggable: interactive,
  });

  let path: LatLng[] = [];
  let restaurantPoint: LatLng | null = null;
  let deliveryPoint: LatLng | null = null;

  const addRouteLayers = () => {
    if (map.getSource(ROUTE_SOURCE)) return;
    map.addSource(ROUTE_SOURCE, { type: "geojson", data: routeGeometry(path) });
    // Styles can mix labels between road layers, so draw above the last road or area layer.
    const layers = map.getStyle().layers;
    const lastShape = layers.findLastIndex((layer) => layer.type === "line" || layer.type === "fill");
    const firstLabel = layers[lastShape + 1]?.id;
    const layout = { "line-cap": "round", "line-join": "round" } as const;
    map.addLayer(
      {
        id: ROUTE_CASING_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout,
        paint: { "line-color": "#252525", "line-opacity": 0.28, "line-width": 8 },
      },
      firstLabel,
    );
    map.addLayer(
      {
        id: ROUTE_LINE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout,
        paint: { "line-color": "#e58a45", "line-width": 5 },
      },
      firstLabel,
    );
  };
  map.on("style.load", addRouteLayers);

  if (interactive) {
    map.on("click", (event) => {
      const target = event.originalEvent.target;
      if (target instanceof Element && target.closest(".map-marker")) return;
      onPick({ lat: event.lngLat.lat, lng: event.lngLat.lng }, "map");
    });
    deliveryMarker.on("dragend", () => {
      const { lat, lng } = deliveryMarker.getLngLat();
      onPick({ lat, lng }, "drag");
    });
  }

  return {
    setRestaurant(point, title) {
      restaurantPoint = point;
      restaurantMarker.getElement().title = title;
      restaurantMarker.setLngLat([point.lng, point.lat]).addTo(map);
    },
    setDelivery(point) {
      deliveryPoint = point;
      if (point) deliveryMarker.setLngLat([point.lng, point.lat]).addTo(map);
      else deliveryMarker.remove();
    },
    setRoute(encodedPolyline) {
      path = encodedPolyline ? decodePolyline(encodedPolyline) : [];
      (map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(routeGeometry(path));
    },
    fit() {
      const points = [restaurantPoint, deliveryPoint, ...path].filter((point): point is LatLng =>
        Boolean(point),
      );
      if (points.length === 0) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (points.length === 1) {
        map.easeTo({ center: [points[0].lng, points[0].lat], duration: reducedMotion ? 0 : 400 });
        return;
      }
      const bounds = new maplibre.LngLatBounds();
      points.forEach(({ lat, lng }) => bounds.extend([lng, lat]));
      map.fitBounds(bounds, { padding: 72, maxZoom: 16, duration: reducedMotion ? 0 : 450 });
    },
    destroy() {
      map.remove();
    },
  };
}
