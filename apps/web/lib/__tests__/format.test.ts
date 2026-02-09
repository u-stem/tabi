import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateRange,
  formatDateShort,
  formatTime,
  formatTimeRange,
  getDayCount,
  validateTimeRange,
} from "../format";

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

describe("formatDateShort", () => {
  it("formats as M/D without year", () => {
    expect(formatDateShort("2025-04-01")).toBe("4/1");
  });

  it("handles double-digit months and days", () => {
    expect(formatDateShort("2025-12-25")).toBe("12/25");
  });
});

describe("formatDateRange", () => {
  it("formats a date range", () => {
    expect(formatDateRange("2025-04-01", "2025-04-03")).toBe("2025年4月1日 - 2025年4月3日");
  });
});

describe("formatTime", () => {
  it("strips seconds from HH:MM:SS format", () => {
    expect(formatTime("09:00:00")).toBe("09:00");
  });

  it("returns HH:MM as-is when no seconds", () => {
    expect(formatTime("14:45")).toBe("14:45");
  });
});

describe("formatTimeRange", () => {
  it("formats both start and end time", () => {
    expect(formatTimeRange("09:00", "17:30")).toBe("09:00 - 17:30");
  });

  it("strips seconds from HH:MM:SS format", () => {
    expect(formatTimeRange("09:00:00", "17:30:00")).toBe("09:00 - 17:30");
  });

  it("formats start time only", () => {
    expect(formatTimeRange("09:00", null)).toBe("09:00");
  });

  it("formats end time only", () => {
    expect(formatTimeRange(null, "17:30")).toBe("- 17:30");
  });

  it("returns empty string when both are null", () => {
    expect(formatTimeRange(null, null)).toBe("");
  });

  it("returns empty string when both are undefined", () => {
    expect(formatTimeRange(undefined, undefined)).toBe("");
  });
});

describe("validateTimeRange", () => {
  it("returns null when both times are valid", () => {
    expect(validateTimeRange("09:00", "17:00")).toBeNull();
  });

  it("returns null when only start time is set", () => {
    expect(validateTimeRange("09:00", undefined)).toBeNull();
  });

  it("returns null when neither time is set", () => {
    expect(validateTimeRange(undefined, undefined)).toBeNull();
  });

  it("returns error when end time is set without start time", () => {
    expect(validateTimeRange(undefined, "17:00")).toBe("開始時間を入力してください");
  });

  it("returns error when start time equals end time", () => {
    expect(validateTimeRange("09:00", "09:00")).toBe("終了時間は開始時間より後にしてください");
  });

  it("returns error when start time is after end time", () => {
    expect(validateTimeRange("18:00", "09:00")).toBe("終了時間は開始時間より後にしてください");
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
