"use client";

import { columnPath, formatTick, linearScale, niceTicks } from "@/components/charts/scale";
import { AxisLabels, SvgPlot, YGrid } from "@/components/charts/SvgPlot";

export interface Series {
  id: string;
  name: string;
  color: string;
}

export interface ColumnDatum {
  label: string;
  values: Record<string, number>;
}

interface ColumnChartProps {
  data: ColumnDatum[];
  series: Series[];
  ariaLabel: string;
  /** Stack series in one column instead of placing them side by side. */
  stacked?: boolean;
  height?: number;
  yLabel?: string;
  xLabel?: string;
  /** Unit after values in the tooltip, such as "orders" or "min". */
  unit?: string;
  digits?: number;
  /** Show every nth x label. */
  labelEvery?: number;
  /** Fixed y maximum, so small multiples share a scale. */
  yMax?: number;
  /** A vertical hairline before data[index], such as zero error. */
  divider?: { index: number; label: string };
}

const MARGIN = { top: 34, right: 12, bottom: 44, left: 48 };
const GAP = 2;

export function ColumnChart({
  data,
  series,
  ariaLabel,
  stacked = false,
  height = 260,
  yLabel,
  xLabel,
  unit = "",
  digits = 0,
  labelEvery = 1,
  yMax,
  divider,
}: ColumnChartProps) {
  const totals = data.map((datum) =>
    stacked
      ? series.reduce((sum, item) => sum + (datum.values[item.id] ?? 0), 0)
      : Math.max(0, ...series.map((item) => datum.values[item.id] ?? 0)),
  );
  // The axis runs to the last round tick, so no tick label sits outside the plot.
  const yTicks = niceTicks(0, yMax ?? Math.max(1, ...totals), 4);
  const top = yTicks[yTicks.length - 1];
  const format = (value: number) =>
    `${value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;

  return (
    <SvgPlot height={height} margin={MARGIN} ariaLabel={ariaLabel}>
      {(layout) => {
        const { innerWidth, innerHeight, tipHandlers } = layout;
        const y = linearScale([0, top], [innerHeight, 0]);
        const band = innerWidth / Math.max(1, data.length);
        const groupWidth = Math.min(stacked ? 24 : 24 * series.length + GAP * (series.length - 1), band - GAP);
        const barWidth = stacked ? groupWidth : (groupWidth - GAP * (series.length - 1)) / series.length;

        return (
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            <YGrid ticks={yTicks} y={y} innerWidth={innerWidth} format={formatTick} />
            {data.map((datum, index) => {
              const left = index * band + (band - groupWidth) / 2;
              let base = innerHeight;
              const visible = series.filter((item) => (datum.values[item.id] ?? 0) > 0);
              const content = {
                title: datum.label,
                rows: series.map((item) => ({
                  label: item.name,
                  value: format(datum.values[item.id] ?? 0),
                  color: series.length > 1 ? item.color : undefined,
                })),
              };
              return (
                <g key={datum.label} className="plot-column">
                  {series.map((item, seriesIndex) => {
                    const value = datum.values[item.id] ?? 0;
                    if (value <= 0) return null;
                    const barHeight = innerHeight - y(value);
                    if (stacked) {
                      const isTop = item.id === visible[visible.length - 1]?.id;
                      const segmentTop = base - barHeight;
                      const path = columnPath(left, segmentTop, barWidth, Math.max(0, barHeight - (isTop ? 0 : GAP)), isTop);
                      base = segmentTop;
                      return <path key={item.id} d={path} fill={item.color} />;
                    }
                    const x = left + seriesIndex * (barWidth + GAP);
                    return <path key={item.id} d={columnPath(x, y(value), barWidth, barHeight)} fill={item.color} />;
                  })}
                  <rect
                    className="plot-hit"
                    x={index * band}
                    y={0}
                    width={band}
                    height={innerHeight}
                    {...tipHandlers(content)}
                  />
                  {index % labelEvery === 0 && (
                    <text className="plot-tick" x={index * band + band / 2} y={innerHeight + 16} textAnchor="middle">
                      {datum.label}
                    </text>
                  )}
                </g>
              );
            })}
            {divider && (
              <g className="plot-divider" aria-hidden="true">
                <line x1={divider.index * band} x2={divider.index * band} y1={-8} y2={innerHeight} />
                <text x={divider.index * band + 4} y={-10}>
                  {divider.label}
                </text>
              </g>
            )}
            <AxisLabels layout={layout} x={xLabel} y={yLabel} />
          </g>
        );
      }}
    </SvgPlot>
  );
}
