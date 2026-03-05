import { useQuery } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TravelTimeSeparator } from "./travel-time-separator";

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: undefined, isLoading: true })),
}));

describe("TravelTimeSeparator", () => {
  const baseProps = {
    tripId: "trip-1",
    originLat: 35.6762,
    originLng: 139.6503,
    destLat: 35.7148,
    destLng: 139.7967,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("データがない場合（ローディング中）は何も表示しない", () => {
    const { container } = render(<TravelTimeSeparator {...baseProps} />);
    expect(container.firstChild).toBeNull();
  });

  it("APIエラー時は何も表示しない", () => {
    vi.mocked(useQuery).mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useQuery>);
    const { container } = render(<TravelTimeSeparator {...baseProps} />);
    expect(container.firstChild).toBeNull();
  });

  it("所要時間を「車で N分」形式で表示する", () => {
    vi.mocked(useQuery).mockReturnValueOnce({
      data: { durationSeconds: 900, encodedPolyline: null },
      isLoading: false,
    } as ReturnType<typeof useQuery>);
    render(<TravelTimeSeparator {...baseProps} />);
    expect(screen.getByText("車で 15分")).toBeDefined();
  });

  it("1時間以上の所要時間を「N時間M分」形式で表示する", () => {
    vi.mocked(useQuery).mockReturnValueOnce({
      data: { durationSeconds: 5400, encodedPolyline: null },
      isLoading: false,
    } as ReturnType<typeof useQuery>);
    render(<TravelTimeSeparator {...baseProps} />);
    expect(screen.getByText("車で 1時間30分")).toBeDefined();
  });

  it("60秒未満の所要時間を「N秒」形式で表示する", () => {
    vi.mocked(useQuery).mockReturnValueOnce({
      data: { durationSeconds: 45, encodedPolyline: null },
      isLoading: false,
    } as ReturnType<typeof useQuery>);
    render(<TravelTimeSeparator {...baseProps} />);
    expect(screen.getByText("車で 45秒")).toBeDefined();
  });
});
