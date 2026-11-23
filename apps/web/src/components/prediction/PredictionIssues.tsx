import { Notice } from "@/components/ui/Notice";
import type { PredictionIssue } from "@/types/prediction";

export function PredictionIssues({ issues }: { issues: PredictionIssue[] }) {
  return (
    <>
      {issues.map((issue) => (
        <Notice key={issue.code} tone={issue.severity === "blocked" ? "error" : "warning"}>
          {issue.message}
        </Notice>
      ))}
    </>
  );
}
