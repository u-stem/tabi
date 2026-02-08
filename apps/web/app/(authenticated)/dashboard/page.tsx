"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TripCard } from "@/components/trip-card";
import { api, ApiError } from "@/lib/api";
import type { TripListItem } from "@tabi/shared";

export default function DashboardPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TripListItem[]>("/api/trips")
      .then(setTrips)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/auth/login");
          return;
        }
        setError("旅行の取得に失敗しました");
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- router is stable, run once on mount
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">マイ旅行</h1>
        <Button asChild>
          <Link href="/trips/new">新しい旅行</Link>
        </Button>
      </div>
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
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <p className="text-lg text-muted-foreground">
            まだ旅行がありません
          </p>
          <p className="text-sm text-muted-foreground">
            最初の旅行プランを作成してみましょう
          </p>
          <Button asChild>
            <Link href="/trips/new">旅行を作成する</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} {...trip} />
          ))}
        </div>
      )}
    </div>
  );
}
