/** Chart colors and number formats shared by the technical pages. No report data here,
 * so client components can import it without bundling the JSON. */

/** Each model keeps one color on every chart. */
export const MODEL_COLORS: Record<string, string> = {
  median: "var(--series-3)",
  decision_tree: "var(--series-1)",
  xgboost: "var(--series-2)",
};

export const PARTITION_COLORS = {
  training: "var(--ordinal-1)",
  validation: "var(--ordinal-2)",
  test: "var(--ordinal-3)",
} as const;

const integer = new Intl.NumberFormat("en-US");
export const formatCount = (value: number) => integer.format(value);
export const formatFixed = (value: number, digits = 2) =>
  value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const formatSigned = (value: number, digits = 2) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatFixed(Math.abs(value), digits)}`;
export const formatPercent = (part: number, whole: number, digits = 1) =>
  `${((100 * part) / whole).toFixed(digits)}%`;

/** "max_depth 5, learning_rate 0.03" for a tuning trial. */
export function formatParameters(parameters: Record<string, string | number>): string {
  const names: Record<string, string> = {
    max_depth: "depth",
    min_samples_leaf: "min leaf",
    learning_rate: "learning rate",
    n_estimators: "trees",
    strategy: "strategy",
  };
  return Object.entries(parameters)
    .map(([key, value]) => `${names[key] ?? key} ${value}`)
    .join(", ");
}
