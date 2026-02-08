"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trip-card";
import { api } from "@/lib/api";

type Trip = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
};

export default function DashboardPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Trip[]>("/api/trips")
      .then(setTrips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Trips</h1>
        <Button asChild>
          <Link href="/trips/new">New Trip</Link>
        </Button>
      </div>
      {loading ? (
        <p className="mt-8 text-muted-foreground">Loading...</p>
      ) : trips.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          No trips yet. Create your first trip!
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
