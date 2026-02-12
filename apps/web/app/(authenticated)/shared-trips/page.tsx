"use client";

import type { TripListItem } from "@sugara/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TripCard } from "@/components/trip-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { MSG } from "@/lib/messages";

export default function SharedTripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "共有された旅行 - sugara";
  }, []);

  const fetchTrips = useCallback(() => {
    setLoading(true);
    setError(null);
    api<TripListItem[]>("/api/trips?scope=shared")
      .then((data) => setTrips(data))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/auth/login");
          return;
        }
        setError(MSG.TRIP_FETCH_FAILED);
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const filteredTrips = useMemo(() => {
    if (!search) return trips;
    const q = search.toLowerCase();
    return trips.filter(
      (t) => t.title.toLowerCase().includes(q) || t.destination.toLowerCase().includes(q),
    );
  }, [trips, search]);

  return (
    <div>
      {loading ? (
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
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchTrips}>
            再試行
          </Button>
        </div>
      ) : trips.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">共有された旅行はありません</p>
      ) : (
        <>
          <div className="mt-4">
            <Input
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
    </div>
  );
}
