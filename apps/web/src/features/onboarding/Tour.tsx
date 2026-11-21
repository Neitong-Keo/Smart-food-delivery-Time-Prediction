"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export function Tour() {
  const [state, setState] = useState(createInitialTourState);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const currentStep = getCurrentStep(state);
  const isFirstStep = state.activeIndex === 0;
  const isLastStep = state.activeIndex === ONBOARDING_STEPS.length - 1;

  const handleClose = useCallback((completed = false) => {
    setState((prev) => closeTour(prev, completed));
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      setState((prev) => openTour(prev));
    }
  }, []);

  useEffect(() => {
    if (state.isOpen) {
      dialogRef.current?.focus();
    }
  }, [state.isOpen]);

  useEffect(() => {
    if (!state.isOpen) {
      return;
    }

    const targetElement = document.getElementById(currentStep.targetId);
    if (targetElement) {
      targetElement.setAttribute("data-tour-active", "true");
      targetElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose(false);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setState((prev) => nextTourStep(prev));
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setState((prev) => previousTourStep(prev));
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (targetElement) {
        targetElement.removeAttribute("data-tour-active");
      }
    };
  }, [state.isOpen, currentStep.targetId, handleClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="button button-secondary"
        onClick={() => setState((prev) => openTour(prev))}
        aria-haspopup="dialog"
        aria-expanded={state.isOpen}
      >
        Take the tour
      </button>

      {state.isOpen && (
        <div
          className="tour-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleClose(false);
            }
          }}
        >
          <div
            ref={dialogRef}
            className="tour-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-step-title"
            aria-describedby="tour-step-description"
            tabIndex={-1}
          >
            <div className="tour-header">
              <span className="badge">
                Step {state.activeIndex + 1} of {ONBOARDING_STEPS.length}
              </span>
              <button
                type="button"
                className="icon-button"
                onClick={() => handleClose(false)}
                aria-label="Dismiss tour"
              >
                ×
              </button>
            </div>

            <h2 id="tour-step-title" className="tour-title">
              {currentStep.title}
            </h2>

            <p id="tour-step-description" className="tour-description">
              {currentStep.description}
            </p>

            <p className="tour-highlight">{currentStep.highlightSummary}</p>

            <div className="tour-dots" role="tablist" aria-label="Tour steps">
              {ONBOARDING_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  role="tab"
                  aria-selected={index === state.activeIndex}
                  aria-label={`Go to step ${index + 1}: ${step.title}`}
                  className={`tour-dot ${index === state.activeIndex ? "tour-dot-active" : ""}`}
                  onClick={() => setState((prev) => goToTourStep(prev, index))}
                />
              ))}
            </div>

            <div className="tour-footer">
              <span className="tour-keys-hint">
                Keys: ← / → navigate, Esc close
              </span>

              <div className="tour-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => handleClose(false)}
                >
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
                  onClick={() => {
                    if (isLastStep) {
                      handleClose(true);
                    } else {
                      setState((prev) => nextTourStep(prev));
                    }
                  }}
                >
                  {isLastStep ? "Finish" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
