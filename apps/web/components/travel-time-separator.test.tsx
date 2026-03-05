import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TravelTimeSeparator } from "./travel-time-separator";

const mockApi = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

// Stub React Query with a minimal implementation
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(({ queryFn }: { queryFn: () => Promise<unknown> }) => {
    // synchronously resolve for testing purposes
    return { data: undefined, isLoading: true };
  }),
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

  it("データがない場合は何も表示しない", () => {
    const { container } = render(<TravelTimeSeparator {...baseProps} />);
    // When data is undefined (loading), nothing is rendered
    expect(container.firstChild).toBeNull();
  });
});
