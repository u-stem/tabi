"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trip-card";
import { api } from "@/lib/api";
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
        if (err instanceof Error && err.message.includes("401")) {
          router.push("/auth/login");
          return;
        }
        setError("旅行の取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">マイ旅行</h1>
        <Button asChild>
          <Link href="/trips/new">新しい旅行</Link>
        </Button>
      </div>
      {loading ? (
        <p className="mt-8 text-muted-foreground">読み込み中...</p>
      ) : error ? (
        <p className="mt-8 text-destructive">{error}</p>
      ) : trips.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          まだ旅行がありません。最初の旅行を作成しましょう!
        </p>
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
