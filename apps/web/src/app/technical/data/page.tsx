import type { Metadata } from "next";

import { DatasetTable } from "@/components/technical/DatasetTable";
import { eda, formatCount } from "@/lib/report";

export const metadata: Metadata = { title: "Dataset" };

export default function DatasetPage() {
  return (
    <>
      <header>
        <p className="tech-eyebrow">1. Dataset</p>
        <h1 className="page-heading">The delivery orders</h1>
        <p className="tech-lede">
          The model learns from the{" "}
          <a className="text-link" href="https://www.kaggle.com/datasets/saurabhbadole/zomato-delivery-operations-analytics-dataset">
            Zomato delivery dataset on Kaggle
          </a>
          : {formatCount(eda.rows)} orders across {eda.cities} Indian cities, placed between {eda.first_order} and{" "}
          {eda.last_order}. Each row is one delivered order with how long it took.
        </p>
      </header>

      <section className="tech-section" aria-labelledby="versions-title">
        <h2 id="versions-title">Two versions of the same rows</h2>
        <ul className="bullets">
          <li>
            <strong>Raw CSV</strong> is the file exactly as downloaded, every value as text. Missing values appear as{" "}
            <code>NaN</code> and the city label has a typo, <code>Metropolitian</code>.
          </li>
          <li>
            <strong>Cleaned</strong> is the same {formatCount(eda.rows)} rows after the cleaning rules: typed numbers,
            one order timestamp, impossible values cleared, plus the straight-line and road distances. The model trains
            on this version. Columns underlined in orange are model inputs.
          </li>
        </ul>
        <p>
          Sort by clicking a column header. Search looks through every text column. The download contains every row that
          matches the current search and filters.
        </p>
      </section>

      <DatasetTable />
    </>
  );
}
