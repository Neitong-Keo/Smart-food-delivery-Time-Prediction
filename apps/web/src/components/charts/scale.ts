/** Minimal scale helpers for the report charts. */

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type Scale = (value: number) => number;

export function linearScale([d0, d1]: [number, number], [r0, r1]: [number, number]): Scale {
  const span = d1 - d0 || 1;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Round numbers that cover [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const rough = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = (normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10) * magnitude;
  const first = Math.floor(min / step) * step;
  const last = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= last + step / 2; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return ticks;
}

/** Extend a domain to the nice ticks around it. */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
  const ticks = niceTicks(min, max, count);
  return ticks.length ? [ticks[0], ticks[ticks.length - 1]] : [min, max];
}

export function formatTick(value: number): string {
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 1000)}K`;
  if (Math.abs(value) >= 1000) return value.toLocaleString("en-US");
  return Number.isInteger(value) ? String(value) : value.toFixed(Math.abs(value) < 1 ? 2 : 1);
}

/** A column with a 4px rounded data end and a square end at the baseline. */
export function columnPath(x: number, y: number, width: number, height: number, round = true): string {
  if (height <= 0 || width <= 0) return "";
  const r = round ? Math.min(4, width / 2, height) : 0;
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    r ? `Q${x},${y} ${x + r},${y}` : "",
    `H${x + width - r}`,
    r ? `Q${x + width},${y} ${x + width},${y + r}` : "",
    `V${y + height}`,
    "Z",
  ].join("");
}
