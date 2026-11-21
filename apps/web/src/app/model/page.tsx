import { ApiStatus } from "@/components/ApiStatus";
import { ModelInsights } from "@/features/model/ModelInsights";

export default function ModelPage() {
  return (
    <>
      <section className="page-header">
        <p className="eyebrow">Model Insights</p>
        <h1 className="page-title">Evaluation &amp; Feature Importance</h1>
        <p className="muted-text">
          Inspect verified model accuracy metrics and global feature drivers reported by the
          FastAPI backend.
        </p>
      </section>

      <ModelInsights metrics={null} />

      <ApiStatus />
    </>
  );
}

