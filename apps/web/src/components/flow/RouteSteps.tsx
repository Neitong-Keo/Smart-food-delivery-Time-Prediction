"use client";

import { Check } from "lucide-react";
import Link from "next/link";

import { useDeliveryDraft } from "@/hooks/use-delivery-draft";

const STEPS = [
  { key: "restaurant", label: "Restaurant", href: "/restaurants" },
  { key: "location", label: "Delivery location", href: "/delivery" },
  { key: "prediction", label: "Delivery time", href: "/predict" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function RouteSteps({ current }: { current: StepKey }) {
  const { draft } = useDeliveryDraft();
  const currentIndex = STEPS.findIndex((step) => step.key === current);
  const reachable: Record<StepKey, boolean> = {
    restaurant: true,
    location: Boolean(draft.restaurantId),
    prediction: Boolean(draft.restaurantId && draft.location),
  };
  const completed: Record<StepKey, boolean> = {
    restaurant: Boolean(draft.restaurantId),
    location: Boolean(draft.restaurantId && draft.location),
    prediction: false,
  };

  return (
    <nav aria-label="Order progress">
      <ol className="route-steps">
        {STEPS.map((step, index) => {
          const state =
            index === currentIndex
              ? "current"
              : index < currentIndex && completed[step.key]
                ? "done"
                : "upcoming";
          const content = (
            <>
              <span className="route-step-node" aria-hidden="true">
                {state === "done" ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span className="route-step-label">{step.label}</span>
            </>
          );
          return (
            <li
              key={step.key}
              className="route-step"
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              {state !== "current" && reachable[step.key] ? (
                <Link href={step.href} className="route-step-inner">
                  {content}
                </Link>
              ) : (
                <span className="route-step-inner">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
