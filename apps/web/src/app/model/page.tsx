import type { Metadata } from "next";

import { ApiStatus } from "@/components/ApiStatus";
import { ModelInsights } from "@/features/model/ModelInsights";

export const metadata: Metadata = { title: "Model Insights" };

export default function ModelPage() {
  return (
    <>
      <section className="page-header">
        <h1 className="page-title">Model insights</h1>
      </section>

      <ModelInsights />

      <ApiStatus />
    </>
  );
}

