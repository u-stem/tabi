"use client";

import type { ScheduleResponse } from "@sugara/shared";
import { AdvancedMarker, Map as GoogleMap, InfoWindow } from "@vis.gl/react-google-maps";
import { useState } from "react";

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

type Props = {
  currentDaySchedules: ScheduleResponse[];
  allSchedules: ScheduleResponse[];
  online: boolean;
};

type MappableSchedule = ScheduleResponse & { latitude: number; longitude: number };

function isMappable(s: ScheduleResponse): s is MappableSchedule {
  return s.latitude != null && s.longitude != null;
}

export function MapPanel({ currentDaySchedules, allSchedules, online }: Props) {
  const [mode, setMode] = useState<MapMode>("day");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!online) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        オフライン時は地図を表示できません
      </div>
    );
  }

  const schedules = mode === "day" ? currentDaySchedules : allSchedules;
  const mappable = schedules.filter(isMappable);

  const center =
    mappable.length > 0
      ? {
          lat: mappable.reduce((sum, s) => sum + s.latitude, 0) / mappable.length,
          lng: mappable.reduce((sum, s) => sum + s.longitude, 0) / mappable.length,
        }
      : { lat: 36.2048, lng: 138.2529 };

  const selectedSchedule = selectedId ? mappable.find((s) => s.id === selectedId) : null;

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
        >
          {mappable.map((schedule, index) => {
            const color = mode === "all" ? DAY_COLORS[index % DAY_COLORS.length] : "#3b82f6";
            return (
              <AdvancedMarker
                key={schedule.id}
                position={{ lat: schedule.latitude, lng: schedule.longitude }}
                onClick={() => setSelectedId(schedule.id === selectedId ? null : schedule.id)}
              >
                <div
                  className="h-3 w-3 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: color }}
                />
              </AdvancedMarker>
            );
          })}
          {selectedSchedule && (
            <InfoWindow
              position={{ lat: selectedSchedule.latitude, lng: selectedSchedule.longitude }}
              onCloseClick={() => setSelectedId(null)}
            >
              <p className="text-sm font-medium">{selectedSchedule.name}</p>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
