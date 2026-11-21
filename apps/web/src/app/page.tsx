"use client";

import Link from "next/link";
import { useState } from "react";

import { ApiStatus } from "@/components/ApiStatus";
import { Tour } from "@/features/onboarding/Tour";
import {
  DEFAULT_ROUTE_SCENARIO,
  SAMPLE_ROUTE_SCENARIOS,
  type TrafficLevel,
  type WeatherCondition,
  estimateIllustrativeEta,
} from "@/features/onboarding/roadKit";

export default function HomePage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState(DEFAULT_ROUTE_SCENARIO.id);
  const [distanceKm, setDistanceKm] = useState<number>(DEFAULT_ROUTE_SCENARIO.distanceKm);
  const [traffic, setTraffic] = useState<TrafficLevel>(DEFAULT_ROUTE_SCENARIO.traffic);
  const [weather, setWeather] = useState<WeatherCondition>(DEFAULT_ROUTE_SCENARIO.weather);

  const selectedScenario =
    SAMPLE_ROUTE_SCENARIOS.find((scenario) => scenario.id === selectedScenarioId) ??
    DEFAULT_ROUTE_SCENARIO;

  const estimate = estimateIllustrativeEta(distanceKm, traffic, weather);
  const distanceScale = distanceKm / selectedScenario.distanceKm;

  const applyScenario = (scenarioId: string) => {
    const match = SAMPLE_ROUTE_SCENARIOS.find((item) => item.id === scenarioId);
    if (!match) {
      return;
    }

    setSelectedScenarioId(match.id);
    setDistanceKm(match.distanceKm);
    setTraffic(match.traffic);
    setWeather(match.weather);
  };

  return (
    <>
      <section id="hero-section" className="hero">
        <h1 className="hero-title">
          How long will delivery take?
        </h1>
        <p className="hero-description">
          Estimate food delivery time in minutes based on route distance, traffic, and weather.
        </p>

        <div className="hero-actions">
          <Link href="/predict" className="button button-primary">
            Estimate delivery time
          </Link>
          <Tour />
        </div>
      </section>

      <section
        id="route-preview-card"
        className="card route-card"
        aria-labelledby="route-preview-title"
      >
        <div className="route-header">
          <div>
            <h2 id="route-preview-title" className="card-title">Sample route explorer</h2>
            <p className="muted-text">Change the route conditions to see how the estimate responds.</p>
          </div>
        </div>

        <div className="scenario-tabs" role="group" aria-label="Sample route presets">
          {SAMPLE_ROUTE_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className={`pill-button ${
                scenario.id === selectedScenario.id ? "pill-button-active" : ""
              }`}
              aria-pressed={scenario.id === selectedScenario.id}
              onClick={() => applyScenario(scenario.id)}
            >
              {scenario.name}
            </button>
          ))}
        </div>

        <div className="route-grid">
          <div className="controls-column">
            <div className="field-group">
              <label htmlFor="distance-slider" className="field-label">
                Route distance <strong aria-hidden="true">{distanceKm.toFixed(1)} km</strong>
              </label>
              <input
                id="distance-slider"
                type="range"
                min={1}
                max={18}
                step={0.1}
                value={distanceKm}
                aria-valuetext={`${distanceKm.toFixed(1)} kilometers`}
                onChange={(event) => setDistanceKm(Number(event.target.value))}
              />
            </div>

            <div className="field-group">
              <label htmlFor="traffic-select" className="field-label">
                Traffic level
              </label>
              <select
                id="traffic-select"
                className="select-input"
                value={traffic}
                onChange={(event) => setTraffic(event.target.value as TrafficLevel)}
              >
                <option value="light">Light traffic</option>
                <option value="moderate">Moderate congestion</option>
                <option value="heavy">Heavy rush-hour traffic</option>
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="weather-select" className="field-label">
                Weather condition
              </label>
              <select
                id="weather-select"
                className="select-input"
                value={weather}
                onChange={(event) => setWeather(event.target.value as WeatherCondition)}
              >
                <option value="clear">Clear skies</option>
                <option value="rain">Rain</option>
                <option value="storm">Heavy storm</option>
              </select>
            </div>
          </div>

          <div className="eta-panel">
            <p className="eyebrow">Illustrative estimate</p>
            <p className="eta-value" aria-live="polite">{estimate.totalMinutes} minutes</p>
            <p className="muted-text">Includes sample kitchen prep and travel time.</p>

            <dl className="breakdown-list">
              <div className="breakdown-row">
                <dt>Kitchen prep (sample)</dt>
                <dd>{estimate.prepMinutes} min</dd>
              </div>
              <div className="breakdown-row">
                <dt>Base distance travel</dt>
                <dd>{estimate.baseTravelMinutes} min</dd>
              </div>
              <div className="breakdown-row">
                <dt>Traffic impact ({traffic})</dt>
                <dd>+{estimate.trafficPenaltyMinutes} min</dd>
              </div>
              <div className="breakdown-row">
                <dt>Weather impact ({weather})</dt>
                <dd>+{estimate.weatherPenaltyMinutes} min</dd>
              </div>
            </dl>
          </div>

          <ol className="waypoint-list" aria-label="Sample route waypoints">
            {selectedScenario.waypoints.map((waypoint) => (
              <li key={waypoint.id} className="waypoint-item">
                <span className="waypoint-role">{waypoint.role}</span>
                <span>{waypoint.label}</span>
                <span className="waypoint-km">
                  {(waypoint.distanceFromStartKm * distanceScale).toFixed(1)} km
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ApiStatus />
    </>
  );
}
