import type { Metadata } from "next";

import { ApiStatus } from "@/components/ApiStatus";
import { PredictionAvailability } from "@/features/prediction/PredictionAvailability";

export const metadata: Metadata = { title: "Estimate Delivery Time" };

export default function PredictPage() {
  return (
    <>
      <section className="page-header">
        <h1 className="page-title">Estimate delivery time</h1>
      </section>

      <PredictionAvailability />

      <ApiStatus />
    </>
  );
}

