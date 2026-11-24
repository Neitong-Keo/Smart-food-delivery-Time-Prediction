/** Shapes of the JSON written by `python -m ml.scripts.export_report` into public/report/. */

interface Generated {
  generated_at: string;
  source_file: string | null;
}

export interface BoxStats {
  count: number;
  mean: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  /** Whiskers: the most extreme values inside 1.5 x IQR. */
  low: number;
  high: number;
  low_fence: number;
  high_fence: number;
  outliers: number;
  outliers_above: number;
  outliers_below: number;
}

export interface CategoryGroup extends BoxStats {
  value: string;
}

export interface EdaReport extends Generated {
  rows: number;
  columns: number;
  first_order: string;
  last_order: string;
  cities: number;
  target: BoxStats;
  target_histogram: { minutes: number; orders: number }[];
  by_hour: { hour: number; orders: number; mean: number; median: number }[];
  by_day: { day: number; label: string; orders: number; mean: number }[];
  by_category: { column: string; label: string; model_input: boolean; groups: CategoryGroup[] }[];
  distance: {
    orders: number;
    pearson: number;
    points: [number, number][];
    bins: { from: number; to: number; orders: number; mean: number; q1: number; q3: number }[];
  };
  missing: {
    column: string;
    label: string;
    raw_missing: number | null;
    missing_after_cleaning: number | null;
    model_input: boolean;
  }[];
  correlation: {
    column: string;
    label: string;
    orders: number;
    pearson: number;
    spearman: number;
    model_input: boolean;
  }[];
}

export interface OutlierRule {
  stage: "cleaning" | "model";
  title: string;
  rule: string;
  rows: number;
  action: string;
}

export interface OutliersReport extends Generated {
  rules: OutlierRule[];
  funnel: { label: string; rows: number }[];
  boxes: (BoxStats & { column: string; label: string; outlier_values: number[] })[];
  /** Share of long deliveries during a festival or with 2+ orders on the trip. */
  long_delivery_festival_or_multi_share: number;
  /** Median road / straight-line distance, for road-distance outliers and for all orders. */
  road_detour_ratio: { outliers: number; all: number };
  max_straight_line_excluded_km: { min: number; max: number };
  retained_straight_line_km: { min: number; max: number };
  road_distance_km: { min: number; max: number };
}

export interface Scores {
  mae: number;
  rmse: number;
  r2: number;
  mean_signed_error_minutes?: number;
}

export interface ModelReportEntry {
  id: string;
  name: string;
  selected: boolean;
  parameters: Record<string, string | number>;
  validation: Scores;
  test: Scores & { mean_signed_error_minutes: number };
  trials: (Scores & { parameters: Record<string, string | number> })[];
  importance: Record<string, number>;
}

export interface ModelReport extends Generated {
  selected_model_id: string;
  target: string;
  features: {
    column: string;
    label: string;
    type: "category" | "number";
    source: string;
    importance: Record<string, number | null>;
  }[];
  models: ModelReportEntry[];
  split: {
    partitions: { name: string; rows: number; share: number; first: string; last: string }[];
    daily: { date: string; training: number; validation: number; test: number }[];
    rows_in_source: number;
    rows_missing_road_distance: number;
    rows_outside_road_distance_limits: number;
    rows_without_usable_timestamp: number;
  };
  limits: {
    training_road_distance_km: { min: number; max: number };
    blocked_road_distance_km: { min: number; max: number };
    supported_order_hours: number[];
    max_point_to_road_m: number;
  };
  evaluation: {
    test_orders: number;
    error_histogram: ({ from: number; to: number } & Record<string, number>)[];
    by_actual: ({ label: string; orders: number } & Record<string, { mae: number; bias: number } | string | number>)[];
    by_minute: ({ actual: number; orders: number } & Record<string, { mean: number; p10: number; p90: number } | number>)[];
    scatter: Record<string, [number, number][]>;
  };
  dataset_sha256: string | null;
}
