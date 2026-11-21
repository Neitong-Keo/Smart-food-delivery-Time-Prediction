"use client";

import { useEffect, useRef, useState } from "react";

import {
  ONBOARDING_STEPS,
  closeTour,
  createInitialTourState,
  getCurrentStep,
  goToTourStep,
  nextTourStep,
  openTour,
  previousTourStep,
} from "./engine";
import { DEFAULT_ROUTE_SCENARIO, estimateIllustrativeEta } from "./roadKit";

const sampleRoute = DEFAULT_ROUTE_SCENARIO;
const longerDistanceKm = sampleRoute.distanceKm + 2;
const routeExamples = [
  {
    label: `Baseline (${sampleRoute.distanceKm} km, ${sampleRoute.traffic} traffic, ${sampleRoute.weather} weather)`,
    estimate: estimateIllustrativeEta(sampleRoute.distanceKm, sampleRoute.traffic, sampleRoute.weather),
  },
  {
    label: `Longer route (${longerDistanceKm.toFixed(1)} km)`,
    estimate: estimateIllustrativeEta(longerDistanceKm, sampleRoute.traffic, sampleRoute.weather),
  },
  {
    label: "Heavy traffic",
    estimate: estimateIllustrativeEta(sampleRoute.distanceKm, "heavy", sampleRoute.weather),
  },
  {
    label: "Rain",
    estimate: estimateIllustrativeEta(sampleRoute.distanceKm, sampleRoute.traffic, "rain"),
  },
];

export function Tour() {
  const [state, setState] = useState(createInitialTourState);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  const currentStep = getCurrentStep(state);
  const isFirstStep = state.activeIndex === 0;
  const isLastStep = state.activeIndex === ONBOARDING_STEPS.length - 1;

  const handleClose = (completed = false) => setState((prev) => closeTour(prev, completed));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      setState((prev) => openTour(prev));
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (state.isOpen && !dialog?.open) {
      dialog?.showModal();
    } else if (!state.isOpen && dialog?.open) {
      dialog.close();
      triggerRef.current?.focus();
    }
  }, [state.isOpen]);

  useEffect(() => {
    if (!state.isOpen) {
      return;
    }

    titleRef.current?.focus({ preventScroll: true });
    const targetElement = document.getElementById(currentStep.targetId);
    targetElement?.setAttribute("data-tour-active", "true");
    targetElement?.scrollIntoView({ block: "nearest" });
    return () => {
      targetElement?.removeAttribute("data-tour-active");
    };
  }, [state.isOpen, currentStep.targetId]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="button button-secondary"
        onClick={() => setState((prev) => openTour(prev))}
        aria-haspopup="dialog"
        aria-expanded={state.isOpen}
        aria-controls="onboarding-tour"
      >
        Take the tour
      </button>

      <dialog
        id="onboarding-tour"
        ref={dialogRef}
        className="tour-dialog"
        aria-labelledby="tour-step-title"
        aria-describedby="tour-step-description"
        onCancel={(event) => {
          event.preventDefault();
          handleClose();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom
          ) {
            handleClose();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            setState(event.key === "ArrowLeft" ? previousTourStep : nextTourStep);
          }

          if (event.key === "Tab") {
            const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
            const first = controls[0];
            const last = controls[controls.length - 1];
            const focused = document.activeElement;

            if (event.shiftKey && (focused === first || focused === titleRef.current)) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && focused === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <p className="eyebrow tour-header">Step {state.activeIndex + 1} of {ONBOARDING_STEPS.length}</p>
        <h2 id="tour-step-title" className="tour-title" ref={titleRef} tabIndex={-1}>
          {currentStep.title}
        </h2>
        <p id="tour-step-description" className="tour-description">
          {currentStep.description}
        </p>

        {currentStep.id === "route-explorer" && (
          <div className="eta-panel tour-estimates">
            <p className="eyebrow">Illustrative estimate</p>
            <p className="muted-text">{sampleRoute.name}</p>
            <dl className="breakdown-list">
              {routeExamples.map(({ label, estimate }) => (
                <div className="breakdown-row" key={label}>
                  <dt>{label}</dt>
                  <dd>{estimate.totalMinutes} min</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="tour-highlight">{currentStep.highlightSummary}</p>

        <div className="tour-footer">
          <div className="tour-dots" role="group" aria-label="Tour steps">
            {ONBOARDING_STEPS.map((step, index) => (
              <button
                key={step.id}
                type="button"
                aria-current={index === state.activeIndex ? "step" : undefined}
                aria-label={`Go to step ${index + 1}: ${step.title}`}
                className="tour-dot"
                onClick={() => setState((prev) => goToTourStep(prev, index))}
              />
            ))}
          </div>

          <div className="tour-actions">
            <button type="button" className="button button-ghost" onClick={() => handleClose()}>
              Close
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={isFirstStep}
              onClick={() => setState((prev) => previousTourStep(prev))}
            >
              Back
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setState((prev) => nextTourStep(prev))}
            >
              {isLastStep ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
