/**
 * The precomputed report data, bundled at build time so the technical pages render
 * without a request. Regenerate with `python -m ml.scripts.export_report` in apps/backend.
 */
import edaJson from "../../public/report/eda.json";
import modelJson from "../../public/report/model.json";
import outliersJson from "../../public/report/outliers.json";

import { MODEL_COLORS } from "@/lib/report-format";
import type { EdaReport, ModelReport, ModelReportEntry, OutliersReport } from "@/types/report";

export * from "@/lib/report-format";

export const eda = edaJson as unknown as EdaReport;
export const outliers = outliersJson as unknown as OutliersReport;
export const modelReport = modelJson as unknown as ModelReport;

export const selectedModel: ModelReportEntry =
  modelReport.models.find((model) => model.selected) ?? modelReport.models[modelReport.models.length - 1];
export const baselineModel: ModelReportEntry | undefined = modelReport.models.find(
  (model) => model.id === "median",
);

export const modelSeries = modelReport.models.map((model) => ({
  id: model.id,
  name: model.name,
  color: MODEL_COLORS[model.id] ?? "var(--series-1)",
}));
