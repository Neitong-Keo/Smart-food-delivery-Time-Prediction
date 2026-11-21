export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetId: string;
  highlightSummary: string;
}

export interface TourState {
  isOpen: boolean;
  activeIndex: number;
  hasCompleted: boolean;
}

export const ONBOARDING_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "What This App Predicts",
    description:
      "Smart Food Delivery Time Prediction estimates total door-to-door delivery duration in minutes using route distance, traffic, and weather conditions.",
    targetId: "hero-section",
    highlightSummary: "Navigate to /predict for the ETA calculator or /model for evaluation insights.",
  },
  {
    id: "api-health",
    title: "Live FastAPI Health Status",
    description:
      "The API status indicator calls GET /api/health via NEXT_PUBLIC_API_BASE_URL (defaulting to http://localhost:8600) and displays checking, online, or offline states.",
    targetId: "api-status-card",
    highlightSummary: "Confirms backend connectivity before submitting prediction requests.",
  },
  {
    id: "route-explorer",
    title: "Sample Route & Illustrative Estimate",
    description:
      "Use the sample routes from roadKit.ts to preview how distance, traffic congestion, and weather affect delivery time. All sample outputs are labeled Illustrative estimate.",
    targetId: "route-preview-card",
    highlightSummary: "Interactive route heuristics let you test scenarios even before live ML inference is wired.",
  },
  {
    id: "theme-and-keys",
    title: "Theme Toggle & Calculator Workspace",
    description:
      "Switch between Deep Navy dark mode and light mode anytime from the header. Press Escape or Close to exit the tour and return focus to the tour button.",
    targetId: "theme-toggle-control",
    highlightSummary: "Keyboard shortcuts: ArrowLeft, ArrowRight, and Escape.",
  },
];

export function createInitialTourState(): TourState {
  return {
    isOpen: false,
    activeIndex: 0,
    hasCompleted: false,
  };
}

export function openTour(state: TourState): TourState {
  return {
    ...state,
    isOpen: true,
    activeIndex: 0,
  };
}

export function closeTour(state: TourState, completed = false): TourState {
  return {
    ...state,
    isOpen: false,
    hasCompleted: state.hasCompleted || completed,
  };
}

export function nextTourStep(state: TourState, totalSteps = ONBOARDING_STEPS.length): TourState {
  if (state.activeIndex >= totalSteps - 1) {
    return closeTour(state, true);
  }

  return {
    ...state,
    activeIndex: state.activeIndex + 1,
  };
}

export function previousTourStep(state: TourState): TourState {
  return {
    ...state,
    activeIndex: Math.max(0, state.activeIndex - 1),
  };
}

export function goToTourStep(
  state: TourState,
  index: number,
  totalSteps = ONBOARDING_STEPS.length
): TourState {
  const boundedIndex = Math.max(0, Math.min(totalSteps - 1, index));
  return {
    ...state,
    activeIndex: boundedIndex,
  };
}

export function getCurrentStep(
  state: TourState,
  steps: TourStep[] = ONBOARDING_STEPS
): TourStep {
  return steps[state.activeIndex] ?? steps[0];
}
