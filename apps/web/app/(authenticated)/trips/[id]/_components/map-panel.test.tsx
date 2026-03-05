import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
}));

const scheduleWithCoords = {
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
  updatedAt: new Date().toISOString(),
} as const;

const scheduleWithoutCoords = {
  ...scheduleWithCoords,
  id: "2",
  name: "spot B",
  latitude: null,
  longitude: null,
} as const;

describe("MapPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("lat/lng があるスポットにのみマーカーを表示する", () => {
    render(
      <MapPanel
        currentDaySchedules={[scheduleWithCoords as never, scheduleWithoutCoords as never]}
        allSchedules={[scheduleWithCoords as never, scheduleWithoutCoords as never]}
        online={true}
      />,
    );
    expect(screen.getAllByTestId("marker")).toHaveLength(1);
  });

  it("オフライン時はメッセージを表示する", () => {
    render(<MapPanel currentDaySchedules={[]} allSchedules={[]} online={false} />);
    expect(screen.getByText(/オフライン/)).toBeDefined();
  });
});
