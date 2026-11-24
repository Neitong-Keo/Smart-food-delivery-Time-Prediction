/** The technical report's sections, in reading order. */
export const TECHNICAL_SECTIONS = [
  { href: "/technical", title: "Overview", summary: "The problem, the approach and the headline results." },
  { href: "/technical/data", title: "Dataset", summary: "Every order in a searchable table, cleaned or raw." },
  { href: "/technical/eda", title: "Exploratory analysis", summary: "What drives delivery time, and what the model can know." },
  { href: "/technical/outliers", title: "Outliers and cleaning", summary: "Each cleaning rule, how many rows it touched and why." },
  { href: "/technical/split", title: "Data split", summary: "Train on older orders, test on newer ones." },
  { href: "/technical/training", title: "Features and training", summary: "Six inputs, one pipeline, and the tuning grid." },
  { href: "/technical/evaluation", title: "Evaluation", summary: "How the three models compare, and their limits." },
  { href: "/technical/slides", title: "Slides", summary: "The presentation, ready to present full screen." },
] as const;
