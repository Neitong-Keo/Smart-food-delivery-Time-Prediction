"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { RestaurantImage } from "@/components/restaurants/RestaurantImage";
import { Notice } from "@/components/ui/Notice";
import { usePredictionHistory } from "@/hooks/use-prediction-history";
import { formatDateTime, formatKm, formatMinutes } from "@/lib/format";

export function HistoryList() {
  const { entries, isLoading, error, remove, clear } = usePredictionHistory();
  const [confirmingClear, setConfirmingClear] = useState(false);

  return (
    <div className="container page">
      <div className="history-header">
        <div>
          <h1 className="page-heading">Prediction history</h1>
          <p className="page-intro">Your past delivery time predictions on this device.</p>
        </div>
        {entries.length > 0 &&
          (confirmingClear ? (
            <div className="history-clear">
              <span className="history-clear-prompt">Clear all {entries.length}?</span>
              <button
                type="button"
                className="button button-danger"
                onClick={() => {
                  void clear();
                  setConfirmingClear(false);
                }}
              >
                Clear history
              </button>
              <button type="button" className="button button-ghost" onClick={() => setConfirmingClear(false)}>
                Keep
              </button>
            </div>
          ) : (
            <button type="button" className="button button-secondary" onClick={() => setConfirmingClear(true)}>
              Clear history
            </button>
          ))}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {isLoading && (
        <div role="status" aria-label="Loading history" style={{ display: "grid", gap: "var(--space-3)" }}>
          {[0, 1, 2].map((row) => (
            <div key={row} className="skeleton" style={{ height: "4rem" }} />
          ))}
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="empty-state">
          <h2>No predictions yet</h2>
          <p>Choose a restaurant and set a location to get your first delivery time.</p>
          <Link href="/restaurants" className="button button-primary">
            Predict delivery time
          </Link>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <table className="history-table">
            <thead>
              <tr>
                <th scope="col">Restaurant</th>
                <th scope="col">Delivered to</th>
                <th scope="col" className="is-numeric">Distance</th>
                <th scope="col" className="is-numeric">Delivery time</th>
                <th scope="col">Predicted on</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <div className="history-restaurant">
                      <RestaurantImage src={entry.restaurantImageUrl} alt="" size={44} />
                      {entry.restaurantName}
                    </div>
                  </td>
                  <td className="history-destination">{entry.destination}</td>
                  <td className="is-numeric">
                    {formatKm(entry.distanceKm)}
                    <span className="history-subnote">
                      {entry.distanceSource === "straight_line" ? "straight line" : "by road"}
                    </span>
                  </td>
                  <td className="is-numeric">
                    <span className="history-time">{formatMinutes(entry.predictedMinutes)}</span>
                    {entry.modelStatus === "demo" && (
                      <span className="history-subnote history-subnote-demo">Demo result</span>
                    )}
                    {entry.modelStatus === "live" && typeof entry.modelName === "string" && (
                      <span className="history-subnote">{entry.modelName}</span>
                    )}
                    {entry.outsideTrainingRange && (
                      <span className="history-subnote">Less certain</span>
                    )}
                  </td>
                  <td className="history-date">{formatDateTime(entry.createdAt)}</td>
                  <td className="history-remove-cell">
                    <button
                      type="button"
                      className="button button-ghost icon-button"
                      aria-label={`Remove prediction for ${entry.restaurantName}`}
                      onClick={() => void remove(entry.id)}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="history-storage-note">History is stored in this browser only.</p>
        </>
      )}
    </div>
  );
}
