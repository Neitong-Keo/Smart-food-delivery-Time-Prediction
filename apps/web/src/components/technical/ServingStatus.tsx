"use client";

import { Notice } from "@/components/ui/Notice";
import { useModelList } from "@/hooks/use-model-list";

const STATUS_LABEL = { live: "Live", demo: "Demo rule", unavailable: "Couldn't load" } as const;

/** Which models the running API serves right now, for the demo. */
export function ServingStatus() {
  const { list, error, retry } = useModelList();

  if (error) {
    return (
      <Notice
        tone="warning"
        title="The API couldn't be reached"
        action={
          <button type="button" className="button button-secondary" onClick={retry}>
            Try again
          </button>
        }
      >
        {error}
      </Notice>
    );
  }
  if (!list) return <div className="skeleton" role="status" aria-label="Checking the API" style={{ height: "4rem" }} />;

  const isDemo = list.models.every((model) => model.status === "demo");
  return (
    <>
      {isDemo ? (
        <Notice tone="demo" title="The API is running the demo rule">
          Predictions use a placeholder rule based on distance. Start the API with{" "}
          <code>PREDICTION_MODE=model</code> to serve the trained models.
        </Notice>
      ) : (
        <div className="data-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Status</th>
                <th scope="col" className="is-numeric">
                  Test MAE
                </th>
              </tr>
            </thead>
            <tbody>
              {list.models.map((model) => (
                <tr key={model.id} className={model.selected ? "is-highlighted" : undefined}>
                  <th scope="row">
                    {model.name}
                    {model.selected && <span className="tag">Selected</span>}
                  </th>
                  <td>{model.detail ?? STATUS_LABEL[model.status]}</td>
                  <td className="is-numeric">{model.test ? `${model.test.mae.toFixed(2)} min` : "Not recorded"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
