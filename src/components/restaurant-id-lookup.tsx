"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSelectedRestaurant } from "@/lib/use-selected-restaurant";

// Internal admins aren't mapped to restaurants, so instead of a picker they
// open one by its ID. Access is still checked server-side by restaurant(id).
export function RestaurantIdLookup({ compact = false }: { compact?: boolean }) {
  const { restaurantId, setRestaurantId } = useSelectedRestaurant();
  const [value, setValue] = useState(restaurantId != null ? String(restaurantId) : "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) setRestaurantId(id);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        inputMode="numeric"
        placeholder="Restaurant ID"
        aria-label="Restaurant ID"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={compact ? "h-8 w-32" : "w-40"}
      />
      <Button type="submit" size="sm" variant={compact ? "outline" : "default"}>
        Open
      </Button>
    </form>
  );
}
