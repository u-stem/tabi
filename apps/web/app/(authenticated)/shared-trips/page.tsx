"use client";

import type { TripListItem } from "@sugara/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { TripCard } from "@/components/trip-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";

export default function SharedTripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<TripListItem[]>("/api/trips?scope=shared")
      .then((data) => setTrips(data))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/auth/login");
          return;
        }
        setError("旅行の取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [router]);

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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
            <div key={key} className="rounded-lg border p-6 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="mt-8 text-destructive">{error}</p>
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
              className="h-8 w-40"
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
