"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { config } from "@/lib/config";

type ConnectionState = "checking" | "online" | "offline";

export function ApiStatus() {
  const healthUrl = `${config.apiBaseUrl}/api/health`;

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
      setDetail(`The delivery API can't be reached at ${config.apiBaseUrl}.`);
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
    <section id="api-status-card" className="status-panel" aria-label="Backend API status">
      <div>
        <h2>Delivery API</h2>
        <p className="status-panel-copy">{detail}</p>
      </div>

      <div className="status-panel-actions">
        <span className={`status-label status-${status}`} role="status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          {statusLabel}
        </span>
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
