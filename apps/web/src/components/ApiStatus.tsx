"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const [detail, setDetail] = useState("Checking the delivery API…");
  const activeCheck = useRef<AbortController | null>(null);

  const checkHealth = useCallback(async () => {
    if (activeCheck.current) return;

    setStatus("checking");
    setDetail("Checking the delivery API…");

    const controller = new AbortController();
    activeCheck.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (activeCheck.current !== controller) return;
      if (!response.ok) {
        setStatus("offline");
        setDetail(`API responded with HTTP ${response.status}.`);
        return;
      }

      const payload: unknown = await response.json();
      if (activeCheck.current !== controller) return;
      if (payload && typeof payload === "object" && "status" in payload && payload.status === "ok") {
        setStatus("online");
        setDetail("The delivery API is reachable.");
      } else {
        setStatus("offline");
        setDetail("Unexpected health payload received from API.");
      }
    } catch {
      if (activeCheck.current !== controller) return;
      setStatus("offline");
      setDetail("Unable to reach the delivery API. Select Recheck API to try again.");
    } finally {
      window.clearTimeout(timeoutId);
      if (activeCheck.current === controller) activeCheck.current = null;
    }
  }, [healthUrl]);

  useEffect(() => {
    void checkHealth();
    return () => {
      activeCheck.current?.abort();
      activeCheck.current = null;
    };
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
          aria-disabled={status === "checking"}
        >
          Recheck API
        </button>
      </div>
    </section>
  );
}

