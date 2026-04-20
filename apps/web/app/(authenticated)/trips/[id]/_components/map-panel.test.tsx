import type { ScheduleResponse } from "@sugara/shared";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/lib/test-utils";
import type { ScheduleWithDayIndex } from "./map-panel";
import { MapPanel } from "./map-panel";

vi.mock("@vis.gl/react-google-maps", () => ({
  Map: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="google-map">{children}</div>
  ),
  AdvancedMarker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  InfoWindow: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="info-window">{children}</div>
  ),
  useMap: vi.fn(() => null),
  useMapsLibrary: vi.fn(() => null),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: undefined })),
  useIsRestoring: vi.fn(() => false),
}));

const baseSchedule: ScheduleResponse = {
  id: "1",
  name: "spot A",
  latitude: 35.6762,
  longitude: 139.6503,
  category: "sightseeing",
  color: "blue",
  endDayOffset: null,
  startTime: null,
  endTime: null,
  address: null,
  memo: null,
  placeId: null,
  urls: [],
  departurePlace: null,
  arrivalPlace: null,
  transportMethod: null,
  sortOrder: 0,
  updatedAt: new Date().toISOString(),
};

const scheduleWithCoords: ScheduleWithDayIndex = { ...baseSchedule, dayIndex: 0 };
const scheduleWithoutCoords: ScheduleWithDayIndex = {
  ...baseSchedule,
  id: "2",
  name: "spot B",
  latitude: null,
  longitude: null,
  dayIndex: 0,
};

describe("MapPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows markers only for spots with lat/lng", () => {
    renderWithIntl(
      <MapPanel
        tripId="trip-1"
        currentDaySchedules={[scheduleWithCoords, scheduleWithoutCoords]}
        allSchedules={[scheduleWithCoords, scheduleWithoutCoords]}
        online={true}
      />,
    );
    expect(screen.getAllByTestId("marker")).toHaveLength(1);
  });

  it("shows offline message when offline", () => {
    renderWithIntl(
      <MapPanel tripId="trip-1" currentDaySchedules={[]} allSchedules={[]} online={false} />,
    );
    expect(screen.getByText(/オフライン/)).toBeDefined();
  });
});
