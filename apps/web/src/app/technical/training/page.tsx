import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";

import { BarList } from "@/components/charts/BarList";
import { ChartFigure, DataTable } from "@/components/charts/ChartFigure";
import {
  MODEL_COLORS,
  eda,
  formatFixed,
  formatParameters,
  modelReport,
  selectedModel,
} from "@/lib/report";

export const metadata: Metadata = { title: "Features and training" };

const GRIDS: Record<string, string> = {
  decision_tree: "Depth 3, 5 or 8 × at least 20 or 80 orders per leaf: 6 combinations.",
  xgboost: "Depth 3 or 5 × learning rate 0.03 or 0.1 × 150 or 300 trees: 8 combinations.",
};

export default function TrainingPage() {
  const tuned = modelReport.models.filter((model) => model.trials.length > 0);
  const baseline = modelReport.models.find((model) => model.id === "median");
  const road = eda.correlation.find((row) => row.column === "road_distance_km");
  const straight = eda.correlation.find((row) => row.column === "distance_km");
  const categorical = modelReport.features.filter((feature) => feature.type === "category");
  const numeric = modelReport.features.filter((feature) => feature.type === "number");

  return (
    <>
      <header>
        <p className="tech-eyebrow">5. Features and training</p>
        <h1 className="page-heading">Features, pipeline and tuning</h1>
        <p className="tech-lede">
          Each model gets the same six inputs and the same preprocessing. Only the final regressor changes. Settings are
          chosen on the validation orders, never on the test orders.
        </p>
      </header>

      <section className="tech-section" aria-labelledby="features-title">
        <h2 id="features-title">The six inputs</h2>
        <p>
          Every input is something the app knows the moment the customer presses predict. Importance is how much the
          validation error grows, in minutes, when that input&apos;s values are shuffled between orders.
        </p>
        <DataTable
          table={{
            columns: [
              { label: "Input" },
              { label: "Type" },
              { label: "Where the app gets it" },
              { label: `Importance (${selectedModel.name})`, numeric: true },
            ],
            rows: modelReport.features.map((feature) => [
              feature.label,
              feature.type === "category" ? "Category" : "Number",
              feature.source,
              `+${formatFixed(Math.max(0, feature.importance[selectedModel.id] ?? 0))} min`,
            ]),
          }}
        />
      </section>

      <section className="tech-section" aria-labelledby="road-title">
        <h2 id="road-title">Why road distance instead of a straight line</h2>
        <p>
          The dataset only has coordinates. The first version of the model used the straight-line distance between them.
          But a rider follows roads, and the app measures the actual route on the map, so a model trained on straight
          lines would receive a different kind of number in the app than it learned from. Training now uses the same
          OSRM road route the app shows, added to every order by <code>ml.scripts.enrich_routes</code>.
        </p>
        {road && straight && (
          <p>
            In this dataset both distances relate to delivery time about equally (correlation{" "}
            {formatFixed(straight.pearson)} for the straight line and {formatFixed(road.pearson)} for the road), so the
            switch isn&apos;t about squeezing out accuracy. It makes training and the app measure the same thing.
          </p>
        )}
      </section>

      <section className="tech-section" aria-labelledby="pipeline-title">
        <h2 id="pipeline-title">The preprocessing pipeline</h2>
        <p>
          <code>ml/pipeline.py</code> builds one scikit-learn pipeline. It&apos;s fitted on training orders only and saved
          whole, so the API transforms each order exactly as training did.
        </p>
        <div className="pipeline" role="img" aria-label="Pipeline diagram: numbers are filled with the median, categories are filled with unknown and one-hot encoded, then both go to the regressor.">
          <div className="pipeline-branches">
            <div className="flow-step">
              <strong>Numbers</strong>
              <span>{numeric.map((feature) => feature.label).join(", ")}</span>
              <span>
                Fill gaps with the training <code>median</code>
              </span>
            </div>
            <div className="flow-step">
              <strong>Categories</strong>
              <span>{categorical.map((feature) => feature.label).join(", ")}</span>
              <span>
                Fill gaps with <code>&quot;unknown&quot;</code>, then one-hot encode. New labels are ignored.
              </span>
            </div>
          </div>
          <ArrowRight className="pipeline-arrow" size={20} aria-hidden />
          <div className="flow-step">
            <strong>ColumnTransformer</strong>
            <span>Joins both into one table of numbers</span>
          </div>
          <ArrowRight className="pipeline-arrow" size={20} aria-hidden />
          <div className="flow-step flow-step-accent">
            <strong>Regressor</strong>
            <span>Median baseline, Decision Tree or XGBoost</span>
          </div>
        </div>
      </section>

      <section className="tech-section" aria-labelledby="tuning-title">
        <h2 id="tuning-title">Hyperparameter tuning</h2>
        <p>
          Each model is fitted once per combination in its grid and scored on the validation orders. The best combination
          is then refitted on training and validation orders together before the final test.
          {baseline && (
            <>
              {" "}
              For reference, the median baseline has a validation error of{" "}
              <strong>{formatFixed(baseline.validation.mae)} min</strong>.
            </>
          )}
        </p>
        <div className="figure-grid">
          {tuned.map((model) => {
            const best = model.trials[0];
            return (
              <ChartFigure
                key={model.id}
                title={model.name}
                tag={model.selected ? { label: "Selected" } : undefined}
                description={GRIDS[model.id]}
                takeaway={`Best: ${formatParameters(best.parameters)}, validation MAE ${formatFixed(best.mae)} min. The worst setting is ${formatFixed(model.trials[model.trials.length - 1].mae - best.mae)} min worse.`}
                table={{
                  columns: [
                    { label: "Settings" },
                    { label: "MAE", numeric: true },
                    { label: "RMSE", numeric: true },
                    { label: "R²", numeric: true },
                  ],
                  rows: model.trials.map((trial) => [
                    formatParameters(trial.parameters),
                    formatFixed(trial.mae, 3),
                    formatFixed(trial.rmse, 3),
                    formatFixed(trial.r2, 3),
                  ]),
                }}
              >
                <BarList
                  format="minutes"
                  labelWidth="10.5rem"
                  max={Math.max(...tuned.flatMap((item) => item.trials.map((trial) => trial.mae)))}
                  series={[{ id: "mae", name: "Validation MAE", color: MODEL_COLORS[model.id] }]}
                  rows={model.trials.map((trial, index) => ({
                    label: formatParameters(trial.parameters),
                    emphasis: index === 0,
                    tag: index === 0 ? "Best" : undefined,
                    values: { mae: trial.mae },
                  }))}
                />
              </ChartFigure>
            );
          })}
        </div>
      </section>

      <ChartFigure
        title="Feature importance"
        description="How much validation MAE grows when each input is shuffled, averaged over five shuffles. Larger means the model relies on it more."
        takeaway="Order hour matters most, then road distance and festival. Order type and day of the week barely matter, which matches the exploratory analysis."
        legend={tuned.map((model) => ({ name: model.name, color: MODEL_COLORS[model.id] }))}
        table={{
          columns: [{ label: "Input" }, ...tuned.map((model) => ({ label: model.name, numeric: true }))],
          rows: modelReport.features.map((feature) => [
            feature.label,
            ...tuned.map((model) => `${formatFixed(feature.importance[model.id] ?? 0, 3)} min`),
          ]),
        }}
      >
        <BarList
          format="minutes"
          labelWidth="9rem"
          series={tuned.map((model) => ({ id: model.id, name: model.name, color: MODEL_COLORS[model.id] }))}
          rows={modelReport.features.map((feature) => ({
            label: feature.label,
            // Shuffling an unused input can lower the error by chance. Draw those as zero; the table keeps the sign.
            values: Object.fromEntries(
              tuned.map((model) => [model.id, Math.max(0, feature.importance[model.id] ?? 0)]),
            ),
          }))}
        />
      </ChartFigure>
    </>
  );
}
