import type { Metadata } from "next";

import { ApiStatus } from "@/components/ApiStatus";
import { ModelInsights } from "@/features/model/ModelInsights";

export const metadata: Metadata = { title: "Model Status" };

export default function ModelPage() {
  return (
    <div className="container page">
      <h1 className="page-heading">Model status</h1>
      <p className="page-intro">Where the delivery time prediction model stands today.</p>
      <div style={{ marginTop: "var(--space-6)" }}>
        <ModelInsights />
        <ApiStatus />
      </div>
    </div>
  );
}
