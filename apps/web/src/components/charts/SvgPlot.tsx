"use client";

import { useEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";

import type { Margin } from "@/components/charts/scale";

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export interface TooltipContent {
  title: string;
  rows: TooltipRow[];
}

export interface PlotLayout {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margin: Margin;
  /** Spread onto a mark (or its larger hit area) to show `content` on hover and focus. */
  tipHandlers: (content: TooltipContent) => {
    tabIndex: number;
    "aria-label": string;
    onPointerEnter: (event: PointerEvent<Element>) => void;
    onPointerMove: (event: PointerEvent<Element>) => void;
    onPointerLeave: () => void;
    onFocus: (event: FocusEvent<Element>) => void;
    onBlur: () => void;
  };
  /** Show a tooltip at a point in plot coordinates, for crosshairs. */
  showTip: (content: TooltipContent, x: number, y: number) => void;
  hideTip: () => void;
}

interface SvgPlotProps {
  height: number;
  margin: Margin;
  ariaLabel: string;
  children: (layout: PlotLayout) => ReactNode;
  onPointerMove?: (x: number, y: number, layout: PlotLayout) => void;
  onPointerLeave?: () => void;
}

const DEFAULT_WIDTH = 640;

/** An SVG drawn at the container's real width, with one shared tooltip. */
export function SvgPlot({ height, margin, ariaLabel, children, onPointerMove, onPointerLeave }: SvgPlotProps) {
  const wrapper = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [tip, setTip] = useState<{ content: TooltipContent; x: number; y: number } | null>(null);

  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const relative = (clientX: number, clientY: number) => {
    const rect = wrapper.current?.getBoundingClientRect();
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: 0, y: 0 };
  };

  const layout: PlotLayout = {
    width,
    height,
    margin,
    innerWidth: Math.max(10, width - margin.left - margin.right),
    innerHeight: Math.max(10, height - margin.top - margin.bottom),
    tipHandlers: (content) => ({
      tabIndex: 0,
      "aria-label": `${content.title}: ${content.rows.map((row) => `${row.label} ${row.value}`).join(", ")}`,
      onPointerEnter: (event) => setTip({ content, ...relative(event.clientX, event.clientY) }),
      onPointerMove: (event) => setTip({ content, ...relative(event.clientX, event.clientY) }),
      onPointerLeave: () => setTip(null),
      onFocus: (event) => {
        const box = event.currentTarget.getBoundingClientRect();
        setTip({ content, ...relative(box.left + box.width / 2, box.top) });
      },
      onBlur: () => setTip(null),
    }),
    showTip: (content, x, y) => setTip({ content, x: x + margin.left, y: y + margin.top }),
    hideTip: () => setTip(null),
  };

  const flip = tip ? tip.x > width * 0.62 : false;

  return (
    <div ref={wrapper} className="plot">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={
          onPointerMove
            ? (event) => {
                const point = relative(event.clientX, event.clientY);
                onPointerMove(point.x - margin.left, point.y - margin.top, layout);
              }
            : undefined
        }
        onPointerLeave={onPointerLeave}
      >
        {children(layout)}
      </svg>
      {tip && (
        <div
          className="plot-tooltip"
          role="presentation"
          style={{
            left: tip.x,
            top: tip.y,
            transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
          }}
        >
          <p className="plot-tooltip-title">{tip.content.title}</p>
          {tip.content.rows.map((row) => (
            <p key={row.label} className="plot-tooltip-row">
              {row.color && <span className="plot-tooltip-key" style={{ background: row.color }} />}
              <strong>{row.value}</strong>
              <span>{row.label}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal gridlines and left-axis labels. */
export function YGrid({
  ticks,
  y,
  innerWidth,
  format = String,
}: {
  ticks: number[];
  y: (value: number) => number;
  innerWidth: number;
  format?: (value: number) => string;
}) {
  return (
    <g className="plot-grid" aria-hidden="true">
      {ticks.map((tick) => (
        <g key={tick} transform={`translate(0, ${y(tick)})`}>
          <line x1={0} x2={innerWidth} className={tick === 0 ? "plot-baseline" : undefined} />
          <text x={-8} dy="0.32em" textAnchor="end">
            {format(tick)}
          </text>
        </g>
      ))}
    </g>
  );
}

export function AxisLabels({
  layout,
  x,
  y,
}: {
  layout: Pick<PlotLayout, "innerWidth" | "innerHeight" | "margin">;
  x?: string;
  y?: string;
}) {
  return (
    <g className="plot-axis-label" aria-hidden="true">
      {x && (
        <text x={layout.innerWidth / 2} y={layout.innerHeight + layout.margin.bottom - 6} textAnchor="middle">
          {x}
        </text>
      )}
      {y && (
        <text x={-layout.margin.left} y={-18} textAnchor="start">
          {y}
        </text>
      )}
    </g>
  );
}
