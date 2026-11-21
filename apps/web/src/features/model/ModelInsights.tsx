import Link from "next/link";

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface ModelEvaluationMetrics {
  modelVersion: string;
  maeMinutes: number;
  rmseMinutes: number;
  featureImportance?: FeatureImportanceItem[];
}

interface ModelInsightsProps {
  metrics: ModelEvaluationMetrics | null;
}

export function ModelInsights({ metrics }: ModelInsightsProps) {
  if (!metrics) {
    return (
      <section className="card" aria-label="Model evaluation availability">
        <div className="route-header">
          <div>
            <p className="eyebrow">Evaluation Status</p>
            <h2 className="card-title">Model evaluation results are not available yet</h2>
          </div>
          <span className="badge badge-warning">Pending backend metrics</span>
        </div>

        <p className="muted-text">
          No trained scikit-learn model or held-out evaluation metrics have been published by the
          backend yet. Once evaluation results are exposed, this page will display the verified
          model version, MAE, RMSE, and global feature importance.
        </p>

        <div className="card-actions">
          <Link href="/predict" className="button button-primary">
            Go to ETA calculator
          </Link>
          <Link href="/?tour=1" className="button button-secondary">
            Take the illustrative tour
          </Link>
        </div>
      </section>
    );
  }

  const maxImportance =
    metrics.featureImportance && metrics.featureImportance.length > 0
      ? Math.max(...metrics.featureImportance.map((item) => item.importance), 0.0001)
      : 1;

  return (
    <>
      <section className="card" aria-label="Held-out model metrics">
        <div className="route-header">
          <div>
            <p className="eyebrow">Verified Evaluation Metrics</p>
            <h2 className="card-title">Model Version {metrics.modelVersion}</h2>
          </div>
          <span className="badge badge-info">Held-out test set</span>
        </div>

        <div className="metric-grid">
          <div className="metric-card">
            <p className="eyebrow">Held-Out MAE</p>
            <p className="metric-value">{metrics.maeMinutes.toFixed(2)} min</p>
            <p className="muted-text">
              On average, predictions are off by {metrics.maeMinutes.toFixed(2)} minutes on
              held-out test orders.
            </p>
          </div>

          <div className="metric-card">
            <p className="eyebrow">Held-Out RMSE</p>
            <p className="metric-value">{metrics.rmseMinutes.toFixed(2)} min</p>
            <p className="muted-text">
              Root mean squared error in minutes, giving higher weight to larger ETA misses.
            </p>
          </div>
        </div>
      </section>

      {metrics.featureImportance && metrics.featureImportance.length > 0 && (
        <section className="card" aria-label="Global feature importance">
          <p className="eyebrow">Global Signal</p>
          <h2 className="card-title">Feature Importance</h2>
          <p className="muted-text">
            Feature importance applies to the model across the evaluation data as a whole, rather
            than explaining any single delivery prediction.
          </p>

          <ul className="importance-list">
            {metrics.featureImportance.map((item) => {
              const widthPct = Math.max(4, Math.round((item.importance / maxImportance) * 100));
              return (
                <li key={item.feature} className="importance-item">
                  <div className="importance-row">
                    <span>{item.feature}</span>
                    <span>{(item.importance * 100).toFixed(1)}%</span>
                  </div>
                  <div className="importance-track" aria-hidden="true">
                    <div className="importance-bar" style={{ width: `${widthPct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

