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
    title: "Welcome to Smart Food Delivery Time Prediction",
    description:
      "Phase 1 establishes the monorepo foundation: a Next.js web app on port 3600, a FastAPI backend on port 8600, and a scikit-learn workflow scaffold inside apps/backend/ml/.",
    targetId: "hero-section",
    highlightSummary: "Monorepo foundation ready for Phase 2 dataset ingestion and training.",
  },
  {
    id: "api-health",
    title: "Live FastAPI Health Monitor",
    description:
      "This status widget calls GET /api/health using NEXT_PUBLIC_API_BASE_URL (defaulting to http://localhost:8600) and clearly distinguishes checking, online, and offline states.",
    targetId: "api-status-card",
    highlightSummary: "Backend boots cleanly with zero datasets or model artifacts present.",
  },
  {
    id: "route-explorer",
    title: "Sample Route & Illustrative ETA Breakdown",
    description:
      "Explore how distance, traffic congestion, and weather conditions influence delivery duration. All Phase 1 ETAs are explicitly labeled as illustrative previews.",
    targetId: "route-preview-card",
    highlightSummary: "Powered by roadKit.ts heuristics until trained model artifacts arrive.",
  },
  {
    id: "theme-and-keys",
    title: "Theme Toggle & Keyboard Navigation",
    description:
      "Switch between light and dark themes at any time. During this tour, use ArrowRight and ArrowLeft to move between steps, or press Escape to exit.",
    targetId: "theme-toggle-control",
    highlightSummary: "Accessible controls and persistent theme preference.",
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

