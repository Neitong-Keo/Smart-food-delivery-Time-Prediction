import type { Metadata } from "next";
import { Suspense } from "react";

import { DeliveryWorkspace } from "@/components/delivery/DeliveryWorkspace";
import { WorkspaceSkeleton } from "@/components/flow/WorkspaceSkeleton";

export const metadata: Metadata = { title: "Delivery Location" };

export default function DeliveryPage() {
  return (
    <Suspense
      fallback={
        <div className="container page">
          <WorkspaceSkeleton />
        </div>
      }
    >
      <DeliveryWorkspace />
    </Suspense>
  );
}
