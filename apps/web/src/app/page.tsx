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
        <span className="badge">Smart Delivery ETA Platform</span>
        <h1 className="hero-title">
          Delivery ETA Intelligence for Real-World Conditions
        </h1>
        <p className="hero-description">
          This app predicts total food delivery time in minutes from trip distance, traffic
          congestion, and weather conditions.
        </p>

        <div className="hero-actions">
          <Link href="/predict" className="button button-primary">
            Estimate delivery time
          </Link>
          <Tour />
        </div>
      </section>

      <div className="grid-two">
        <ApiStatus />

        <section className="card" aria-label="Workspace navigation">
          <p className="eyebrow">Explore Platform</p>
          <h2 className="card-title">Calculator &amp; Model Evaluation</h2>
          <p className="muted-text">
            Enter delivery conditions on the ETA calculator or inspect verified model metrics as
            they become available from the FastAPI service.
          </p>
          <div className="card-actions">
            <Link href="/predict" className="button button-primary">
              Open ETA calculator
            </Link>
            <Link href="/model" className="button button-secondary">
              View model insights
            </Link>
          </div>
        </section>
      </div>

      <section
        id="route-preview-card"
        className="card route-card"
        aria-label="Illustrative route preview"
      >
        <div className="route-header">
          <div>
            <p className="eyebrow">Sample Route Explorer</p>
            <h2 className="card-title">Distance, Traffic &amp; Weather Preview</h2>
          </div>
          <span className="badge badge-warning">Illustrative estimate</span>
        </div>

        <div className="scenario-tabs" role="group" aria-label="Sample route presets">
          {SAMPLE_ROUTE_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className={`pill-button ${
                scenario.id === selectedScenario.id ? "pill-button-active" : ""
              }`}
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
                Route distance: <strong>{distanceKm.toFixed(1)} km</strong>
              </label>
              <input
                id="distance-slider"
                type="range"
                min={1}
                max={18}
                step={0.1}
                value={distanceKm}
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
                <option value="rain">Rain (+6 min)</option>
                <option value="storm">Heavy storm (+13 min)</option>
              </select>
            </div>

            <ol className="waypoint-list" aria-label="Sample route waypoints">
              {selectedScenario.waypoints.map((waypoint) => (
                <li key={waypoint.id} className="waypoint-item">
                  <span className="waypoint-role">{waypoint.role}</span>
                  <span>{waypoint.label}</span>
                  <span className="waypoint-km">{waypoint.distanceFromStartKm.toFixed(1)} km</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="eta-panel" aria-live="polite">
            <p className="eyebrow">Illustrative estimate</p>
            <p className="eta-value">{estimate.label}</p>
            <p className="muted-text">{estimate.disclaimer}</p>

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
        </div>
      </section>
    </>
  );
}
