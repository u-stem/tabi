"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { DayTimeline } from "@/components/day-timeline";
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

type Trip = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  days: Day[];
};

export default function TripDetailPage() {
  const params = useParams();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTrip = useCallback(async () => {
    try {
      const data = await api<Trip>(`/api/trips/${tripId}`);
      setTrip(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!trip) {
    return <p className="text-destructive">Trip not found</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Timeline */}
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-muted-foreground">
            {trip.destination} / {trip.startDate} - {trip.endDate}
          </p>
        </div>
        <div className="space-y-6">
          {trip.days.map((day) => (
            <DayTimeline
              key={day.id}
              tripId={tripId}
              dayId={day.id}
              dayNumber={day.dayNumber}
              date={day.date}
              spots={day.spots}
              onRefresh={fetchTrip}
            />
          ))}
        </div>
      </div>

      {/* Right: Map */}
      <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
        <TripMap spots={trip.days.flatMap((day) => day.spots)} />
      </div>
    </div>
  );
}
