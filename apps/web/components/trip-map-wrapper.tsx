"use client";

import dynamic from "next/dynamic";

type Spot = {
  id: string;
  name: string;
  category: string;
  latitude?: string | null;
  longitude?: string | null;
};

// Dynamic import to avoid SSR issues with Leaflet
const TripMapInner = dynamic(
  () => import("./trip-map").then((mod) => mod.TripMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading map...
      </div>
    ),
  },
);

export function TripMap({ spots }: { spots: Spot[] }) {
  return <TripMapInner spots={spots} />;
}
