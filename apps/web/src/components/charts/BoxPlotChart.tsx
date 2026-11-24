"use client";

import { formatTick, linearScale, niceDomain, niceTicks } from "@/components/charts/scale";
import { AxisLabels, SvgPlot } from "@/components/charts/SvgPlot";

export interface BoxGroup {
  label: string;
  count: number;
  mean: number;
  q1: number;
  median: number;
  q3: number;
  low: number;
  high: number;
  min?: number;
  max?: number;
  outliers?: number;
  /** Values beyond the whiskers to draw as dots. */
  outlierValues?: number[];
}

interface BoxPlotChartProps {
  groups: BoxGroup[];
  ariaLabel: string;
  color?: string;
  xLabel?: string;
  unit?: string;
  domain?: [number, number];
  /** Width reserved for group labels on the left. */
  labelWidth?: number;
}

const ROW = 38;

/** Horizontal box plots: whiskers at 1.5 x IQR, box from Q1 to Q3, line at the median. */
export function BoxPlotChart({
  groups,
  ariaLabel,
  color = "var(--series-1)",
  xLabel,
  unit = "",
  domain,
  labelWidth = 108,
}: BoxPlotChartProps) {
  const margin = { top: 8, right: 20, bottom: 40, left: labelWidth };
  const values = groups.flatMap((group) => [group.low, group.high, ...(group.outlierValues ?? []), group.max ?? group.high]);
  const xd = domain ?? niceDomain(Math.min(0, ...values), Math.max(...values), 6);
  const fmt = (value: number) => `${Number(value.toFixed(1))}${unit ? ` ${unit}` : ""}`;

  return (
    <SvgPlot height={margin.top + margin.bottom + groups.length * ROW} margin={margin} ariaLabel={ariaLabel}>
      {(layout) => {
        const x = linearScale(xd, [0, layout.innerWidth]);
        return (
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            <g className="plot-grid" aria-hidden="true">
              {niceTicks(xd[0], xd[1], 6).map((tick) => (
                <g key={tick} transform={`translate(${x(tick)}, 0)`}>
                  <line y1={0} y2={layout.innerHeight} />
                  <text className="plot-tick" y={layout.innerHeight + 16} textAnchor="middle">
                    {formatTick(tick)}
                  </text>
                </g>
              ))}
            </g>
            {groups.map((group, index) => {
              const cy = index * ROW + ROW / 2;
              const content = {
                title: `${group.label} (${group.count.toLocaleString("en-US")} orders)`,
                rows: [
                  { label: "median", value: fmt(group.median) },
                  { label: "mean", value: fmt(group.mean) },
                  { label: "middle half", value: `${fmt(group.q1)} to ${fmt(group.q3)}` },
                  { label: "whiskers", value: `${fmt(group.low)} to ${fmt(group.high)}` },
                  ...(group.outliers ? [{ label: "beyond whiskers", value: group.outliers.toLocaleString("en-US") }] : []),
                ],
              };
              return (
                <g key={group.label} className="plot-box">
                  <text className="plot-category" x={-10} y={cy} dy="0.32em" textAnchor="end">
                    {group.label}
                  </text>
                  <line className="plot-whisker" x1={x(group.low)} x2={x(group.high)} y1={cy} y2={cy} />
                  <line className="plot-whisker" x1={x(group.low)} x2={x(group.low)} y1={cy - 6} y2={cy + 6} />
                  <line className="plot-whisker" x1={x(group.high)} x2={x(group.high)} y1={cy - 6} y2={cy + 6} />
                  <rect
                    x={x(group.q1)}
                    y={cy - 11}
                    width={Math.max(2, x(group.q3) - x(group.q1))}
                    height={22}
                    rx={4}
                    fill={color}
                    className="plot-box-fill"
                  />
                  <line className="plot-median" x1={x(group.median)} x2={x(group.median)} y1={cy - 11} y2={cy + 11} />
                  {(group.outlierValues ?? []).map((value, outlierIndex) => (
                    <circle key={outlierIndex} className="plot-outlier" cx={x(value)} cy={cy} r={3} />
                  ))}
                  <rect className="plot-hit" x={-margin.left} y={index * ROW} width={layout.width} height={ROW} {...layout.tipHandlers(content)} />
                </g>
              );
            })}
            <AxisLabels layout={layout} x={xLabel} />
          </g>
        );
      }}
    </SvgPlot>
  );
}
