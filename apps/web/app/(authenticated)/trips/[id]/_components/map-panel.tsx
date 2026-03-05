"use client";

import type { ScheduleResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import {
  AdvancedMarker,
  Map as GoogleMap,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { SCHEDULE_COLOR_HEX } from "@/lib/colors";

// Day color palette (cycles when more than 10 days)
const DAY_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

type MapMode = "day" | "all";

export type ScheduleWithDayIndex = ScheduleResponse & { dayIndex: number };

type Props = {
  tripId: string;
  currentDaySchedules: ScheduleResponse[];
  allSchedules: ScheduleWithDayIndex[];
  online: boolean;
};

type MappableSchedule = ScheduleResponse & { latitude: number; longitude: number };
type MappableScheduleWithDay = ScheduleWithDayIndex & { latitude: number; longitude: number };

// Same runtime check, but separate predicates are required for TypeScript to
// narrow the return type correctly in each call site.
function isMappable(s: ScheduleResponse): s is MappableSchedule {
  return s.latitude != null && s.longitude != null;
}

function isMappableWithDay(s: ScheduleWithDayIndex): s is MappableScheduleWithDay {
  return s.latitude != null && s.longitude != null;
}

// Calls fitBounds whenever the map instance becomes available or `trigger` changes.
// Positions are read via ref so data updates within a mode don't cause unwanted re-fits.
function MapAutoFit({
  positions,
  trigger,
}: {
  positions: { lat: number; lng: number }[];
  trigger: string;
}) {
  const map = useMap();
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  useEffect(() => {
    const pts = positionsRef.current;
    if (!map || pts.length === 0) return;

    if (pts.length === 1) {
      map.setCenter(pts[0]);
      map.setZoom(15);
      return;
    }

    const bounds = pts.reduce(
      (b, { lat, lng }) => ({
        north: Math.max(b.north, lat),
        south: Math.min(b.south, lat),
        east: Math.max(b.east, lng),
        west: Math.min(b.west, lng),
      }),
      { north: -90, south: 90, east: -180, west: 180 },
    );
    map.fitBounds(bounds, 40);
  }, [map, trigger]);

  return null;
}

// Draws a single route polyline between two mappable schedules.
// Shares React Query cache with TravelTimeSeparator via identical query keys.
function RoutePolyline({
  tripId,
  origin,
  dest,
}: {
  tripId: string;
  origin: MappableSchedule;
  dest: MappableSchedule;
}) {
  const queryKey =
    origin.placeId && dest.placeId
      ? ["directions", origin.placeId, dest.placeId, "DRIVING"]
      : ["directions", origin.latitude, origin.longitude, dest.latitude, dest.longitude, "DRIVING"];

  const params = new URLSearchParams({
    tripId,
    originLat: String(origin.latitude),
    originLng: String(origin.longitude),
    destLat: String(dest.latitude),
    destLng: String(dest.longitude),
    ...(origin.placeId ? { originPlaceId: origin.placeId } : {}),
    ...(dest.placeId ? { destPlaceId: dest.placeId } : {}),
  });

  const { data } = useQuery({
    queryKey,
    queryFn: () =>
      api<{ durationSeconds: number; encodedPolyline: string | null }>(`/api/directions?${params}`),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const map = useMap();
  const geometryLib = useMapsLibrary("geometry");
  const mapsLib = useMapsLibrary("maps");

  useEffect(() => {
    if (!data?.encodedPolyline || !map || !geometryLib || !mapsLib) return;

    const path = geometryLib.encoding.decodePath(data.encodedPolyline);
    const polyline = new mapsLib.Polyline({
      path,
      map,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.7,
      strokeWeight: 4,
    });

    return () => {
      polyline.setMap(null);
    };
  }, [data, map, geometryLib, mapsLib]);

  return null;
}

export function MapPanel({ tripId, currentDaySchedules, allSchedules, online }: Props) {
  const [mode, setMode] = useState<MapMode>("day");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!online) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        オフライン時は地図を表示できません
      </div>
    );
  }

  // markerColor is computed here to avoid type assertions in JSX
  const mappable =
    mode === "day"
      ? currentDaySchedules.filter(isMappable).map((s) => ({
          ...s,
          markerColor: SCHEDULE_COLOR_HEX[s.color] ?? "#3b82f6",
        }))
      : allSchedules.filter(isMappableWithDay).map((s) => ({
          ...s,
          markerColor: DAY_COLORS[s.dayIndex % DAY_COLORS.length],
        }));

  const positions = mappable.map(({ latitude, longitude }) => ({ lat: latitude, lng: longitude }));

  const center =
    mappable.length > 0
      ? {
          lat: mappable.reduce((sum, s) => sum + s.latitude, 0) / mappable.length,
          lng: mappable.reduce((sum, s) => sum + s.longitude, 0) / mappable.length,
        }
      : { lat: 36.2048, lng: 138.2529 };

  const selectedSchedule = selectedId ? mappable.find((s) => s.id === selectedId) : null;

  // Non-transport mappable schedules in sort order for route drawing (当日 mode only)
  const routePoints =
    mode === "day"
      ? currentDaySchedules.filter(isMappable).filter((s) => s.category !== "transport")
      : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b">
        <button
          type="button"
          className={`flex-1 px-4 py-2 text-sm ${mode === "day" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          onClick={() => setMode("day")}
        >
          当日
        </button>
        <button
          type="button"
          className={`flex-1 px-4 py-2 text-sm ${mode === "all" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          onClick={() => setMode("all")}
        >
          全期間
        </button>
      </div>
      <div className="flex-1">
        <GoogleMap
          defaultCenter={center}
          defaultZoom={13}
          mapId="sugara-trip-map"
          className="h-full w-full"
          onClick={() => setSelectedId(null)}
        >
          <MapAutoFit positions={positions} trigger={mode} />
          {mappable.map((schedule) => (
            <AdvancedMarker
              key={schedule.id}
              position={{ lat: schedule.latitude, lng: schedule.longitude }}
              onClick={() => setSelectedId(schedule.id === selectedId ? null : schedule.id)}
            >
              <div
                className="h-3 w-3 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: schedule.markerColor }}
              />
            </AdvancedMarker>
          ))}
          {selectedSchedule && (
            <InfoWindow
              position={{ lat: selectedSchedule.latitude, lng: selectedSchedule.longitude }}
              onCloseClick={() => setSelectedId(null)}
              headerDisabled
            >
              {/* InfoWindow always has a white background regardless of app theme,
                  so hardcode dark text to avoid invisible text in dark mode */}
              <p style={{ color: "#000", fontSize: "0.875rem", fontWeight: 500, margin: 0 }}>
                {selectedSchedule.name}
              </p>
            </InfoWindow>
          )}
          {routePoints.map((dest, i) => {
            if (i === 0) return null;
            const origin = routePoints[i - 1];
            return (
              <RoutePolyline
                key={`route-${origin.id}-${dest.id}`}
                tripId={tripId}
                origin={origin}
                dest={dest}
              />
            );
          })}
        </GoogleMap>
      </div>
    </div>
  );
}
