"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TripMap } from "@/components/trip-map-wrapper";
import { api } from "@/lib/api";

type Spot = {
  id: string;
  name: string;
  category: string;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

type Day = {
  id: string;
  dayNumber: number;
  date: string;
  spots: Spot[];
};

type SharedTrip = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: Day[];
};

const categoryLabels: Record<string, string> = {
  sightseeing: "Sight",
  restaurant: "Food",
  hotel: "Hotel",
  transport: "Move",
  activity: "Play",
  other: "Other",
};

export default function SharedTripPage() {
  const params = useParams();
  const token = params.token as string;
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SharedTrip>(`/api/shared/${token}`)
      .then(setTrip)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="p-8 text-muted-foreground">Loading...</p>;
  if (error) return <p className="p-8 text-destructive">{error}</p>;
  if (!trip) return <p className="p-8 text-destructive">Trip not found</p>;

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{trip.title}</h1>
        <p className="text-muted-foreground">
          {trip.destination} / {trip.startDate} - {trip.endDate}
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          {trip.days.map((day) => (
            <div key={day.id} className="space-y-3">
              <h3 className="font-semibold">
                Day {day.dayNumber}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {day.date}
                </span>
              </h3>
              {day.spots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No spots</p>
              ) : (
                <div className="space-y-2">
                  {day.spots.map((spot) => (
                    <div key={spot.id} className="rounded-md border p-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                          {categoryLabels[spot.category] ?? spot.category}
                        </span>
                        <span className="font-medium">{spot.name}</span>
                        {spot.startTime && (
                          <span className="text-xs text-muted-foreground">
                            {spot.startTime}
                            {spot.endTime && ` - ${spot.endTime}`}
                          </span>
                        )}
                      </div>
                      {spot.memo && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {spot.memo}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
          <TripMap spots={trip.days.flatMap((day) => day.spots)} />
        </div>
      </div>
    </div>
  );
}
