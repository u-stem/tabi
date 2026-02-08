"use client";

import dynamic from "next/dynamic";
import type { SpotResponse } from "@tabi/shared";

// Dynamic import to avoid SSR issues with Leaflet
const TripMapInner = dynamic(
  () => import("./trip-map").then((mod) => mod.TripMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        地図を読み込み中...
      </div>
    ),
  },
);

export function TripMap({ spots }: { spots: SpotResponse[] }) {
  return <TripMapInner spots={spots} />;
}
