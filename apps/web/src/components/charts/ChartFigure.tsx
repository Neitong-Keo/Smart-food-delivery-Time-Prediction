import type { ReactNode } from "react";

export interface LegendItem {
  name: string;
  color: string;
  shape?: "rect" | "line" | "dot";
}

export interface TableColumn {
  label: string;
  numeric?: boolean;
}

export interface FigureTable {
  columns: TableColumn[];
  rows: (string | number)[][];
}

interface ChartFigureProps {
  title: string;
  /** One or two sentences on what the chart shows. */
  description?: ReactNode;
  /** Short badge after the title, such as "Model input" or "Not used". */
  tag?: { label: string; tone?: "accent" | "muted" };
  legend?: LegendItem[];
  table?: FigureTable;
  /** What the chart means, under it. */
  takeaway?: ReactNode;
  children: ReactNode;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="legend" aria-label="Legend">
      {items.map((item) => (
        <li key={item.name}>
          <span className={`legend-key legend-key-${item.shape ?? "rect"}`} style={{ background: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

export function DataTable({ table, caption }: { table: FigureTable; caption?: string }) {
  return (
    <div className="data-table-scroll">
      <table className="data-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column.label} scope="col" className={column.numeric ? "is-numeric" : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={table.columns[cellIndex]?.numeric ? "is-numeric" : undefined}>
                  {typeof cell === "number" ? cell.toLocaleString("en-US") : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A titled chart with its legend, a table of the same numbers, and what it means. */
export function ChartFigure({ title, description, tag, legend, table, takeaway, children }: ChartFigureProps) {
  return (
    <figure className="figure">
      <figcaption className="figure-head">
        <h3 className="figure-title">
          {title}
          {tag && <span className={`tag ${tag.tone === "muted" ? "tag-muted" : ""}`}>{tag.label}</span>}
        </h3>
        {description && <p className="figure-description">{description}</p>}
      </figcaption>
      {legend && legend.length > 1 && <Legend items={legend} />}
      <div className="figure-body">{children}</div>
      {takeaway && <p className="figure-takeaway">{takeaway}</p>}
      {table && (
        <details className="figure-table">
          <summary>Show the numbers</summary>
          <DataTable table={table} />
        </details>
      )}
    </figure>
  );
}
