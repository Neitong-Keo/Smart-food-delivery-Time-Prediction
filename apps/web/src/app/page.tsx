"use client";

import { useState } from "react";

import { ApiStatus } from "@/components/ApiStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    <div className="page-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            SF
          </span>
          <div>
            <p className="brand-title">Smart Food Delivery Time Prediction</p>
            <p className="brand-subtitle">Phase 1 Monorepo Foundation</p>
          </div>
        </div>

        <nav className="top-actions" aria-label="Header controls">
          <Tour />
          <ThemeToggle />
        </nav>
      </header>

      <main className="main-content">
        <section id="hero-section" className="hero">
          <span className="badge">Phase 1 · Web + API + ML Scaffold</span>
          <h1 className="hero-title">
            Delivery ETA Intelligence, Built for Real-World Conditions
          </h1>
          <p className="hero-description">
            Explore how route distance, traffic congestion, and weather affect delivery windows.
            This Phase 1 platform connects the Next.js App Router frontend to the FastAPI backend
            while scaffolding the scikit-learn pipeline inside <code>apps/backend/ml/</code>.
          </p>
        </section>

        <div className="grid-two">
          <ApiStatus />

          <section className="card" aria-label="Phase 1 architecture summary">
            <p className="eyebrow">Monorepo Layout</p>
            <h2 className="card-title">Ready for Dataset Ingestion & Training</h2>
            <ul className="feature-list">
              <li>
                <strong>Web App:</strong> Next.js + TypeScript on port <code>3600</code>
              </li>
              <li>
                <strong>FastAPI Service:</strong> Health endpoint on port <code>8600</code>
              </li>
              <li>
                <strong>ML Workflow:</strong> <code>apps/backend/ml/</code> with CLI entry points
                <code> python -m ml.scripts.ingest</code> and <code>python -m ml.scripts.train</code>
              </li>
            </ul>
          </section>
        </div>

        <section
          id="route-preview-card"
          className="card route-card"
          aria-label="Illustrative route preview"
        >
          <div className="route-header">
            <div>
              <p className="eyebrow">roadKit.ts Sample Route</p>
              <h2 className="card-title">Distance, Traffic & Weather Preview</h2>
            </div>
            <span className="badge badge-warning">Illustrative ETA Only</span>
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
                  Route Distance: <strong>{distanceKm.toFixed(1)} km</strong>
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
                  Traffic Level
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
                  Weather Condition
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
              <p className="eyebrow">Sample Output</p>
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
      </main>
    </div>
  );
}

