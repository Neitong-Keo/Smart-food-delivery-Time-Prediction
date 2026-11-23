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
    highlightSummary: "Open Restaurants to start an order, or Model to check the status of the trained model.",
  },
  {
    id: "api-health",
    title: "Check the API connection",
    description:
      "The health indicator shows whether the app can reach the delivery API.",
    targetId: "api-status-card",
    highlightSummary: "If the API is offline, select Recheck API to try the connection again.",
  },
  {
    id: "route-explorer",
    title: "Try the sample route",
    description:
      "Compare the usual route with three alternatives. Each alternative changes one delivery condition.",
    targetId: "route-preview-card",
    highlightSummary: "Change the controls in the sample route explorer to try your own combinations.",
  },
  {
    id: "theme-and-keys",
    title: "Choose your theme",
    description:
      "Use the theme button in the header to switch between light and dark mode.",
    targetId: "theme-toggle-control",
    highlightSummary: "Select Finish to close the tour and try the sample route.",
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
