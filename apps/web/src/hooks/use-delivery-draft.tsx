"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { isValidLatLng } from "@/lib/geo";
import type { DeliveryLocation, RouteSummary } from "@/types/location";
import type { OrderType } from "@/types/prediction";
import { ORDER_TYPES } from "@/types/prediction";

export interface DeliveryDraft {
  restaurantId: string | null;
  location: DeliveryLocation | null;
  route: RouteSummary | null;
  orderType: OrderType;
  isFestival: boolean;
}

interface DeliveryDraftContextValue {
  draft: DeliveryDraft;
  isHydrated: boolean;
  selectRestaurant: (id: string) => void;
  setLocation: (location: DeliveryLocation) => void;
  setRoute: (route: RouteSummary | null) => void;
  setOrderDetails: (details: Partial<Pick<DeliveryDraft, "orderType" | "isFestival">>) => void;
  resetDraft: () => void;
}

const STORAGE_KEY = "smart-delivery-draft-v2";
const EMPTY_DRAFT: DeliveryDraft = {
  restaurantId: null,
  location: null,
  route: null,
  orderType: "meal",
  isFestival: false,
};

const DeliveryDraftContext = createContext<DeliveryDraftContextValue | null>(null);

function readStoredDraft(): DeliveryDraft {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null") as
      | Partial<DeliveryDraft>
      | null;
    if (!stored) return EMPTY_DRAFT;
    const location = stored.location && isValidLatLng(stored.location) ? stored.location : null;
    return {
      restaurantId: typeof stored.restaurantId === "string" ? stored.restaurantId : null,
      location,
      route: location && stored.route?.key ? stored.route : null,
      orderType: ORDER_TYPES.some((type) => type.value === stored.orderType)
        ? (stored.orderType as OrderType)
        : "meal",
      isFestival: stored.isFestival === true,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function DeliveryDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DeliveryDraft>(EMPTY_DRAFT);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setDraft(readStoredDraft());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // The draft still works for this page view if storage is unavailable.
    }
  }, [draft, isHydrated]);

  const selectRestaurant = useCallback((id: string) => {
    setDraft((current) =>
      current.restaurantId === id ? current : { ...current, restaurantId: id, route: null },
    );
  }, []);

  const setLocation = useCallback((location: DeliveryLocation) => {
    setDraft((current) => {
      const moved = current.location?.lat !== location.lat || current.location?.lng !== location.lng;
      return { ...current, location, route: moved ? null : current.route };
    });
  }, []);

  const setRoute = useCallback((route: RouteSummary | null) => {
    setDraft((current) => ({ ...current, route }));
  }, []);

  const setOrderDetails = useCallback<DeliveryDraftContextValue["setOrderDetails"]>((details) => {
    setDraft((current) => ({ ...current, ...details }));
  }, []);

  const resetDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);

  const value = useMemo(
    () => ({ draft, isHydrated, selectRestaurant, setLocation, setRoute, setOrderDetails, resetDraft }),
    [draft, isHydrated, selectRestaurant, setLocation, setRoute, setOrderDetails, resetDraft],
  );

  return <DeliveryDraftContext.Provider value={value}>{children}</DeliveryDraftContext.Provider>;
}

export function useDeliveryDraft(): DeliveryDraftContextValue {
  const context = useContext(DeliveryDraftContext);
  if (!context) throw new Error("useDeliveryDraft must be used inside DeliveryDraftProvider.");
  return context;
}
