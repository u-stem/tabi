"use client";

import type { TripListItem } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { TripCard } from "@/components/trip-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { useDelayedLoading } from "@/lib/use-delayed-loading";

export default function SharedTripsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const {
    data: trips = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.trips.shared(),
    queryFn: () => api<TripListItem[]>("/api/trips?scope=shared"),
  });
  useAuthRedirect(error);

  const showSkeleton = useDelayedLoading(isLoading);

  useEffect(() => {
    document.title = "共有旅行 - sugara";
  }, []);

  const filteredTrips = useMemo(() => {
    if (!search) return trips;
    const q = search.toLowerCase();
    return trips.filter(
      (t) => t.title.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q),
    );
  }, [trips, search]);

  // Avoid flashing empty state during the 200ms skeleton delay
  if (isLoading && !showSkeleton) return <div />;

  const invalidateTrips = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.shared() });

  return (
    <PullToRefresh onRefresh={invalidateTrips} enabled={!isLoading}>
      {showSkeleton ? (
        <>
          <div className="mt-4">
            <Skeleton className="h-8 w-40" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
              <div key={key} className="rounded-xl border bg-card shadow">
                <div className="flex flex-col space-y-1.5 p-6">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="p-6 pt-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-1 h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : error ? (
        <div className="mt-8 text-center">
          <p className="text-destructive">{MSG.TRIP_FETCH_FAILED}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.trips.shared() })}
          >
            再試行
          </Button>
        </div>
      ) : trips.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">共有された旅行はありません</p>
      ) : (
        <>
          <div className="mt-4">
            <Input
              id="shared-trips-search"
              name="search"
              type="search"
              placeholder="検索..."
              aria-label="旅行を検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full sm:w-40"
            />
          </div>
          {filteredTrips.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground">条件に一致する旅行がありません</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTrips.map((trip) => (
                <TripCard key={trip.id} {...trip} />
              ))}
            </div>
          )}
        </>
      )}
    </PullToRefresh>
  );
}
