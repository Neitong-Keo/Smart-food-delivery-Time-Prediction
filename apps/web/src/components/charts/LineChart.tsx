"use client";

import { useState } from "react";

import { formatTick, linearScale, niceDomain, niceTicks } from "@/components/charts/scale";
import { AxisLabels, SvgPlot, YGrid } from "@/components/charts/SvgPlot";

export interface LineSeries {
  id: string;
  name: string;
  color: string;
  points: [number, number][];
  /** Shaded range at each x: [x, low, high]. */
  band?: [number, number, number][];
  /** Draw a marker on every point. Use for short series only. */
  markers?: boolean;
}

export interface PointCloud {
  id: string;
  name: string;
  color: string;
  points: [number, number][];
}

interface LineChartProps {
  series: LineSeries[];
  ariaLabel: string;
  /** Faint points drawn under the lines, such as a sample of orders. */
  clouds?: PointCloud[];
  /** A dashed reference line, such as "predicted = actual". */
  reference?: { from: [number, number]; to: [number, number]; label: string };
  height?: number;
  xLabel?: string;
  yLabel?: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  /** "hour" labels 0-23 as 12 AM to 11 PM. */
  xFormat?: "number" | "hour";
  unit?: string;
  digits?: number;
}

const MARGIN = { top: 34, right: 16, bottom: 44, left: 48 };

const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;

export function LineChart({
  series,
  ariaLabel,
  clouds = [],
  reference,
  height = 280,
  xLabel,
  yLabel,
  xDomain,
  yDomain,
  xFormat = "number",
  unit = "",
  digits = 1,
}: LineChartProps) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const allX = [...series.flatMap((item) => item.points.map(([x]) => x)), ...clouds.flatMap((c) => c.points.map(([x]) => x))];
  const allY = [
    ...series.flatMap((item) => [...item.points.map(([, y]) => y), ...(item.band ?? []).flatMap(([, lo, hi]) => [lo, hi])]),
    ...clouds.flatMap((cloud) => cloud.points.map(([, y]) => y)),
  ];
  const xd = xDomain ?? niceDomain(Math.min(...allX), Math.max(...allX), 6);
  const yd = yDomain ?? niceDomain(Math.min(0, ...allY), Math.max(...allY), 5);
  const xs = Array.from(new Set(series.flatMap((item) => item.points.map(([x]) => x)))).sort((a, b) => a - b);
  const formatX = (value: number) => (xFormat === "hour" ? hourLabel(value) : formatTick(value));
  const formatY = (value: number) =>
    `${value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;

  return (
    <SvgPlot
      height={height}
      margin={MARGIN}
      ariaLabel={ariaLabel}
      onPointerMove={(px, _py, layout) => {
        if (!xs.length) return;
        const x = linearScale([0, layout.innerWidth], xd)(px);
        const nearest = xs.reduce((best, value) => (Math.abs(value - x) < Math.abs(best - x) ? value : best), xs[0]);
        setHoverX(nearest);
        const toX = linearScale(xd, [0, layout.innerWidth]);
        layout.showTip(
          {
            title: xLabel ? `${xLabel}: ${formatX(nearest)}` : formatX(nearest),
            rows: series.flatMap((item) => {
              const point = item.points.find(([px2]) => px2 === nearest);
              return point ? [{ label: item.name, value: formatY(point[1]), color: series.length > 1 ? item.color : undefined }] : [];
            }),
          },
          toX(nearest),
          layout.innerHeight / 3,
        );
      }}
      onPointerLeave={() => setHoverX(null)}
    >
      {(layout) => {
        const { innerWidth, innerHeight } = layout;
        const x = linearScale(xd, [0, innerWidth]);
        const y = linearScale(yd, [innerHeight, 0]);
        const line = (points: [number, number][]) =>
          points.map(([px, py], index) => `${index ? "L" : "M"}${x(px).toFixed(1)},${y(py).toFixed(1)}`).join("");
        const inside = (domain: [number, number]) => (tick: number) => tick >= domain[0] && tick <= domain[1];
        const xTicks = (xFormat === "hour" ? [0, 3, 6, 9, 12, 15, 18, 21] : niceTicks(xd[0], xd[1], 6)).filter(inside(xd));
        const yTicks = niceTicks(yd[0], yd[1], 5).filter(inside(yd));

        return (
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`} onPointerLeave={layout.hideTip}>
            <YGrid ticks={yTicks} y={y} innerWidth={innerWidth} format={formatTick} />
            <g className="plot-grid" aria-hidden="true">
              {xTicks.map((tick) => (
                <text key={tick} className="plot-tick" x={x(tick)} y={innerHeight + 16} textAnchor="middle">
                  {formatX(tick)}
                </text>
              ))}
            </g>
            {clouds.map((cloud) => (
              <g key={cloud.id} fill={cloud.color} className="plot-cloud" aria-hidden="true">
                {cloud.points.map(([px, py], index) => (
                  <circle key={index} cx={x(px)} cy={y(py)} r={2.25} />
                ))}
              </g>
            ))}
            {series.map(
              (item) =>
                item.band && (
                  <path
                    key={`${item.id}-band`}
                    className="plot-band"
                    fill={item.color}
                    d={`${line(item.band.map(([bx, lo]) => [bx, lo]))}${item.band
                      .slice()
                      .reverse()
                      .map(([bx, , hi]) => `L${x(bx).toFixed(1)},${y(hi).toFixed(1)}`)
                      .join("")}Z`}
                  />
                ),
            )}
            {reference && (
              <g className="plot-reference" aria-hidden="true">
                <line x1={x(reference.from[0])} y1={y(reference.from[1])} x2={x(reference.to[0])} y2={y(reference.to[1])} />
                <text x={x(reference.to[0]) - 6} y={y(reference.to[1]) - 8} textAnchor="end">
                  {reference.label}
                </text>
              </g>
            )}
            {series.map((item) => (
              <g key={item.id}>
                <path className="plot-line" stroke={item.color} d={line(item.points)} />
                {item.markers &&
                  item.points.map(([px, py]) => (
                    <circle key={px} className="plot-marker" cx={x(px)} cy={y(py)} r={4} fill={item.color} />
                  ))}
              </g>
            ))}
            {hoverX !== null && (
              <g aria-hidden="true">
                <line className="plot-crosshair" x1={x(hoverX)} x2={x(hoverX)} y1={0} y2={innerHeight} />
                {series.map((item) => {
                  const point = item.points.find(([px]) => px === hoverX);
                  return point ? (
                    <circle key={item.id} className="plot-marker" cx={x(point[0])} cy={y(point[1])} r={4.5} fill={item.color} />
                  ) : null;
                })}
              </g>
            )}
            <rect className="plot-hit" x={0} y={0} width={innerWidth} height={innerHeight} aria-hidden="true" />
            <AxisLabels layout={layout} x={xLabel} y={yLabel} />
          </g>
        );
      }}
    </SvgPlot>
  );
}
