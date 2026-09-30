"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardContent } from "@/components/dashboard-content";
import { useCurrentUser } from "@/lib/use-current-user";

// Bare /dashboard has no venue in the URL to scope to. Once we know the
// user's default restaurant, bounce to its real, shareable URL
// (/dashboard/[restaurantId]) instead of rendering at this generic one.
// Internal admins (empty access[]) have no default, so they stay here and
// DashboardContent shows the restaurant-ID lookup instead.
export default function DashboardIndexPage() {
  const { user } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    const defaultRestaurantId = user?.access[0]?.restaurant.id;
    if (defaultRestaurantId != null) {
      router.replace(`/dashboard/${defaultRestaurantId}`);
    }
  }, [user, router]);

  return <DashboardContent />;
}
