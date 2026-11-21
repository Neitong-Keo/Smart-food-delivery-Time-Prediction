"use client";

import { useCallback, useEffect, useState } from "react";

type ConnectionState = "checking" | "online" | "offline";

const DEFAULT_API_BASE_URL = "http://localhost:8600";

function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return (configured || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export function ApiStatus() {
  const apiBaseUrl = getApiBaseUrl();
  const healthUrl = `${apiBaseUrl}/api/health`;

  const [status, setStatus] = useState<ConnectionState>("checking");
  const [detail, setDetail] = useState<string>("Checking FastAPI health endpoint...");

  const checkHealth = useCallback(async () => {
    setStatus("checking");
    setDetail("Checking FastAPI health endpoint...");

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        setStatus("offline");
        setDetail(`API responded with HTTP ${response.status}.`);
        return;
      }

      const payload = (await response.json()) as { status?: string };
      if (payload.status === "ok") {
        setStatus("online");
        setDetail('FastAPI responded with {"status": "ok"}.');
      } else {
        setStatus("offline");
        setDetail("Unexpected health payload received from API.");
      }
    } catch {
      setStatus("offline");
      setDetail("Unable to reach the FastAPI backend. Start uvicorn or Docker Compose.");
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [healthUrl]);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const statusLabel =
    status === "checking" ? "Checking" : status === "online" ? "Online" : "Offline";

  return (
    <section id="api-status-card" className="card status-card" aria-label="Backend API status">
      <div className="status-card-header">
        <div>
          <p className="eyebrow">Backend Connectivity</p>
          <h2 className="card-title">FastAPI Health Check</h2>
        </div>

        <span
          className={`status-pill status-${status}`}
          role="status"
          aria-live="polite"
        >
          <span className="status-dot" aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <p className="muted-text">{detail}</p>

      <div className="status-meta">
        <code className="code-chip">GET {healthUrl}</code>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void checkHealth()}
          disabled={status === "checking"}
        >
          {status === "checking" ? "Checking..." : "Recheck API"}
        </button>
      </div>
    </section>
  );
}

