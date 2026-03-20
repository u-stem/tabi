"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";

type Props = {
  tripId: string;
  originLat: number;
  originLng: number;
  originPlaceId?: string | null;
  destLat: number;
  destLng: number;
  destPlaceId?: string | null;
};

function useFormatDuration() {
  const tt = useTranslations("travelTime");
  return (seconds: number): string => {
    if (seconds < 60) return tt("seconds", { count: seconds });
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return tt("minutes", { count: minutes });
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem > 0 ? tt("hoursAndMinutes", { hours, minutes: rem }) : tt("hours", { hours });
  };
}

export function TravelTimeSeparator({
  tripId,
  originLat,
  originLng,
  originPlaceId,
  destLat,
  destLng,
  destPlaceId,
}: Props) {
  const tt = useTranslations("travelTime");
  const formatDuration = useFormatDuration();
  // Use placeId as cache key when available for stability across re-renders
  const queryKey =
    originPlaceId && destPlaceId
      ? ["directions", originPlaceId, destPlaceId, "DRIVING"]
      : ["directions", originLat, originLng, destLat, destLng, "DRIVING"];

  const params = new URLSearchParams({
    tripId,
    originLat: String(originLat),
    originLng: String(originLng),
    destLat: String(destLat),
    destLng: String(destLng),
    ...(originPlaceId ? { originPlaceId } : {}),
    ...(destPlaceId ? { destPlaceId } : {}),
  });

  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      api<{ durationSeconds: number; encodedPolyline: string | null }>(`/api/directions?${params}`),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!data) return null;

  return (
    <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      <span>{tt("byCar", { duration: formatDuration(data.durationSeconds) })}</span>
      <span>→</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
