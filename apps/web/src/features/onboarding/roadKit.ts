export type TrafficLevel = "light" | "moderate" | "heavy";
export type WeatherCondition = "clear" | "rain" | "storm";

export interface RouteWaypoint {
  id: string;
  label: string;
  role: "kitchen" | "corridor" | "dropoff";
  distanceFromStartKm: number;
}

export interface SampleRouteScenario {
  id: string;
  name: string;
  distanceKm: number;
  traffic: TrafficLevel;
  weather: WeatherCondition;
  waypoints: RouteWaypoint[];
}

export interface IllustrativeEtaEstimate {
  totalMinutes: number;
  prepMinutes: number;
  baseTravelMinutes: number;
  trafficPenaltyMinutes: number;
  weatherPenaltyMinutes: number;
  isIllustrative: true;
  label: string;
  disclaimer: string;
}

const KITCHEN_PREP_MINUTES = 10;
const BASE_MINUTES_PER_KM = 3.2;

const TRAFFIC_MULTIPLIER: Record<TrafficLevel, number> = {
  light: 1.0,
  moderate: 1.35,
  heavy: 1.75,
};

const WEATHER_EXTRA_MINUTES: Record<WeatherCondition, number> = {
  clear: 0,
  rain: 6,
  storm: 13,
};

export const SAMPLE_ROUTE_SCENARIOS: SampleRouteScenario[] = [
  {
    id: "downtown-lunch",
    name: "Downtown Lunch Rush",
    distanceKm: 4.8,
    traffic: "moderate",
    weather: "clear",
    waypoints: [
      { id: "wp-1", label: "Bistro Central Kitchen", role: "kitchen", distanceFromStartKm: 0 },
      { id: "wp-2", label: "Riverside Blvd Corridor", role: "corridor", distanceFromStartKm: 2.6 },
      { id: "wp-3", label: "Northside Office Tower", role: "dropoff", distanceFromStartKm: 4.8 },
    ],
  },
  {
    id: "rainy-evening",
    name: "Rainy Evening Commute",
    distanceKm: 7.2,
    traffic: "heavy",
    weather: "rain",
    waypoints: [
      { id: "wp-1", label: "Harbor Noodle House", role: "kitchen", distanceFromStartKm: 0 },
      { id: "wp-2", label: "Midtown Ring Road", role: "corridor", distanceFromStartKm: 3.9 },
      { id: "wp-3", label: "Oakridge Apartments", role: "dropoff", distanceFromStartKm: 7.2 },
    ],
  },
  {
    id: "late-night-clear",
    name: "Late-Night Express",
    distanceKm: 3.1,
    traffic: "light",
    weather: "clear",
    waypoints: [
      { id: "wp-1", label: "Sunset Grill", role: "kitchen", distanceFromStartKm: 0 },
      { id: "wp-2", label: "Market Street", role: "corridor", distanceFromStartKm: 1.5 },
      { id: "wp-3", label: "University Dorms", role: "dropoff", distanceFromStartKm: 3.1 },
    ],
  },
];

export const DEFAULT_ROUTE_SCENARIO = SAMPLE_ROUTE_SCENARIOS[0];

export function estimateIllustrativeEta(
  distanceKm: number,
  traffic: TrafficLevel,
  weather: WeatherCondition
): IllustrativeEtaEstimate {
  const clampedDistance = Math.max(0.5, Math.min(25, distanceKm));
  const baseTravelMinutes = Math.round(clampedDistance * BASE_MINUTES_PER_KM);
  const trafficAdjusted = Math.round(baseTravelMinutes * TRAFFIC_MULTIPLIER[traffic]);
  const trafficPenaltyMinutes = Math.max(0, trafficAdjusted - baseTravelMinutes);
  const weatherPenaltyMinutes = WEATHER_EXTRA_MINUTES[weather];
  const totalMinutes =
    KITCHEN_PREP_MINUTES + baseTravelMinutes + trafficPenaltyMinutes + weatherPenaltyMinutes;

  return {
    totalMinutes,
    prepMinutes: KITCHEN_PREP_MINUTES,
    baseTravelMinutes,
    trafficPenaltyMinutes,
    weatherPenaltyMinutes,
    isIllustrative: true,
    label: `~${totalMinutes} min (Illustrative)`,
    disclaimer:
      "Illustrative Phase 1 estimate using sample route heuristics — not a live scikit-learn prediction.",
  };
}

