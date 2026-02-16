import { describe, expect, it } from "vitest";
import { generateDateRange } from "../lib/trip-days";

describe("generateDateRange", () => {
  it("returns single date when start equals end", () => {
    expect(generateDateRange("2025-01-01", "2025-01-01")).toEqual(["2025-01-01"]);
  });

  it("returns consecutive dates for a range", () => {
    expect(generateDateRange("2025-01-01", "2025-01-03")).toEqual([
      "2025-01-01",
      "2025-01-02",
      "2025-01-03",
    ]);
  });

  it("handles month boundary", () => {
    expect(generateDateRange("2025-01-30", "2025-02-02")).toEqual([
      "2025-01-30",
      "2025-01-31",
      "2025-02-01",
      "2025-02-02",
    ]);
  });

  it("handles year boundary", () => {
    expect(generateDateRange("2025-12-30", "2026-01-02")).toEqual([
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
    ]);
  });

  it("returns empty array when start is after end", () => {
    expect(generateDateRange("2025-01-05", "2025-01-01")).toEqual([]);
  });

  it("respects MAX_TRIP_DAYS limit", () => {
    const result = generateDateRange("2020-01-01", "2025-12-31");
    expect(result).toHaveLength(365);
  });
});
