import { ApiStatus } from "@/components/ApiStatus";
import { PredictionCalculator } from "@/features/prediction/PredictionCalculator";

export default function PredictPage() {
  return (
    <>
      <section className="page-header">
        <p className="eyebrow">ETA Calculator</p>
        <h1 className="page-title">Estimate Delivery Time</h1>
        <p className="muted-text">
          Enter trip distance, traffic level, weather condition, and order time to prepare a
          delivery time estimate.
        </p>
      </section>

      <PredictionCalculator />

      <ApiStatus />
    </>
  );
}

