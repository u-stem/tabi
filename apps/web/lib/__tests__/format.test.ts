import { describe, expect, it } from "vitest";
import { formatDate, formatDateRange, getDayCount } from "../format";

describe("formatDate", () => {
  it("formats a date string to Japanese format", () => {
    expect(formatDate("2025-04-01")).toBe("2025年4月1日");
  });

  it("handles double-digit months and days", () => {
    expect(formatDate("2025-12-25")).toBe("2025年12月25日");
  });

  it("handles single-digit month and day", () => {
    expect(formatDate("2025-01-03")).toBe("2025年1月3日");
  });
});

describe("formatDateRange", () => {
  it("formats a date range", () => {
    expect(formatDateRange("2025-04-01", "2025-04-03")).toBe("2025年4月1日 - 2025年4月3日");
  });
});

describe("getDayCount", () => {
  it("returns 1 for same start and end date", () => {
    expect(getDayCount("2025-04-01", "2025-04-01")).toBe(1);
  });

  it("returns correct count for multi-day range", () => {
    expect(getDayCount("2025-04-01", "2025-04-03")).toBe(3);
  });

  it("handles month boundaries", () => {
    expect(getDayCount("2025-01-30", "2025-02-01")).toBe(3);
  });

  it("handles year boundaries", () => {
    expect(getDayCount("2025-12-30", "2026-01-02")).toBe(4);
  });
});
