"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Which restaurant the nav/dashboard are currently scoped to. Just the
// manual override — combined with the user's access list (first entry as
// the default) by useSelectedRestaurant.
interface RestaurantContextValue {
  manualRestaurantId: string | null;
  setManualRestaurantId: (id: string) => void;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [manualRestaurantId, setManualRestaurantId] = useState<string | null>(null);
  return (
    <RestaurantContext.Provider value={{ manualRestaurantId, setManualRestaurantId }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurantContext() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error("useRestaurantContext must be used within RestaurantProvider");
  return ctx;
}
