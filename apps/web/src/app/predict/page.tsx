import type { Metadata } from "next";

import { PredictionWorkspace } from "@/components/prediction/PredictionWorkspace";

export const metadata: Metadata = { title: "Delivery Time" };

export default function PredictPage() {
  return <PredictionWorkspace />;
}
