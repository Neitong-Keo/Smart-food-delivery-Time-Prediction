import type { Series } from "@/components/charts/ColumnChart";

export type ValueFormat = "count" | "minutes" | "fixed2" | "fixed3" | "signed2" | "signed3";

export interface BarRow {
  label: string;
  /** Small text under the label. */
  note?: string;
  /** Short badge after the label, such as "Model input". */
  tag?: string;
  values: Record<string, number | null>;
  /** Draw this row's label in the primary weight. */
  emphasis?: boolean;
  /** Bar color for this row, when rows are entities with their own color (such as models). */
  color?: string;
}

interface BarListProps {
  rows: BarRow[];
  series: Series[];
  format: ValueFormat;
  /** Signed values grow left or right from zero, blue for positive and red for negative. */
  signed?: boolean;
  /** Fixed largest magnitude, so several lists share a scale. */
  max?: number;
  labelWidth?: string;
  /** Put each label above its bar, for narrow cards. */
  stacked?: boolean;
}

export function formatValue(value: number, format: ValueFormat): string {
  const fixed = (digits: number) =>
    Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  switch (format) {
    case "count":
      return Math.round(value).toLocaleString("en-US");
    case "minutes":
      return `${value < 0 ? "−" : ""}${fixed(2)} min`;
    case "fixed2":
      return `${value < 0 ? "−" : ""}${fixed(2)}`;
    case "fixed3":
      return `${value < 0 ? "−" : ""}${fixed(3)}`;
    case "signed2":
      return `${sign}${fixed(2)}`;
    case "signed3":
      return `${sign}${fixed(3)}`;
  }
}

/** Horizontal bars with the value at each bar's tip. Plain HTML, so it reflows on any width. */
export function BarList({
  rows,
  series,
  format,
  signed = false,
  max,
  labelWidth = "11rem",
  stacked = false,
}: BarListProps) {
  const magnitude =
    max ?? Math.max(1e-9, ...rows.flatMap((row) => series.map((item) => Math.abs(row.values[item.id] ?? 0))));

  return (
    <div
      className={`bar-list ${stacked ? "bar-list-stacked" : ""}`}
      style={{ ["--bar-label-width" as string]: labelWidth }}
    >
      {rows.map((row) => (
        <div key={row.label} className="bar-row">
          <div className="bar-label">
            <span className={row.emphasis ? "bar-label-strong" : undefined}>{row.label}</span>
            {row.tag && <span className="tag">{row.tag}</span>}
            {row.note && <span className="bar-note">{row.note}</span>}
          </div>
          <div className="bar-tracks">
            {series.map((item) => {
              const value = row.values[item.id];
              if (value === null || value === undefined) {
                return (
                  <div key={item.id} className="bar-track">
                    <span className="bar-value bar-value-empty">Not recorded</span>
                  </div>
                );
              }
              const share = Math.min(1, Math.abs(value) / magnitude);
              const color = signed
                ? value < 0
                  ? "var(--series-negative)"
                  : "var(--series-1)"
                : (row.color ?? item.color);
              return (
                <div
                  key={item.id}
                  className={`bar-track ${signed ? "bar-track-signed" : ""}`}
                  title={`${row.label}${series.length > 1 ? `, ${item.name}` : ""}: ${formatValue(value, format)}`}
                >
                  <span
                    className={`bar-fill ${signed && value < 0 ? "bar-fill-negative" : ""}`}
                    style={{ width: `${(signed ? 50 : 100) * share}%`, background: color }}
                  />
                  <span
                    className="bar-value"
                    style={
                      signed
                        ? value < 0
                          ? { right: `calc(50% + ${50 * share}% + 6px)` }
                          : { left: `calc(50% + ${50 * share}% + 6px)` }
                        : { left: `calc(${100 * share}% + 6px)` }
                    }
                  >
                    {formatValue(value, format)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
