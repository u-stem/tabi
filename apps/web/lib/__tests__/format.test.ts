import { describe, expect, it } from "vitest";
import {
  compareByStartTime,
  formatDate,
  formatDateRange,
  formatDateShort,
  formatTime,
  formatTimeRange,
  getCrossDayTimeStatus,
  getDayCount,
  getTimeStatus,
  validateTimeRange,
} from "../format";
import { MSG } from "../messages";

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
    expect(validateTimeRange(undefined, "17:00")).toBe(MSG.TIME_START_REQUIRED);
  });

  it("returns error when start time equals end time", () => {
    expect(validateTimeRange("09:00", "09:00")).toBe(MSG.TIME_END_BEFORE_START);
  });

  it("returns error when start time is after end time", () => {
    expect(validateTimeRange("18:00", "09:00")).toBe(MSG.TIME_END_BEFORE_START);
  });

  it("allows overnight time range for hotel category", () => {
    expect(validateTimeRange("15:00", "10:00", { allowOvernight: true })).toBeNull();
  });

  it("still requires start time for hotel when only end time is set", () => {
    expect(validateTimeRange(undefined, "10:00", { allowOvernight: true })).toBe(
      MSG.TIME_START_REQUIRED,
    );
  });

  it("returns hotel-specific error when end time is set without start time", () => {
    expect(validateTimeRange(undefined, "10:00", { category: "hotel" })).toBe(
      MSG.TIME_HOTEL_CHECKIN_REQUIRED,
    );
  });

  it("returns transport-specific error when end time is set without start time", () => {
    expect(validateTimeRange(undefined, "10:00", { category: "transport" })).toBe(
      MSG.TIME_TRANSPORT_DEPARTURE_REQUIRED,
    );
  });

  it("returns hotel-specific error when end time is before start time", () => {
    expect(validateTimeRange("18:00", "09:00", { category: "hotel" })).toBe(
      MSG.TIME_HOTEL_CHECKOUT_AFTER,
    );
  });

  it("returns transport-specific error when end time is before start time", () => {
    expect(validateTimeRange("18:00", "09:00", { category: "transport" })).toBe(
      MSG.TIME_TRANSPORT_ARRIVAL_AFTER,
    );
  });
});

describe("getTimeStatus", () => {
  it("returns future when no times are set", () => {
    expect(getTimeStatus("12:00", null, null)).toBe("future");
  });

  it("returns future when only endTime is set", () => {
    expect(getTimeStatus("12:00", null, "13:00")).toBe("future");
  });

  it("returns past when endTime <= now", () => {
    expect(getTimeStatus("15:00", "10:00", "14:00")).toBe("past");
  });

  it("returns past when endTime equals now", () => {
    expect(getTimeStatus("14:00", "10:00", "14:00")).toBe("past");
  });

  it("returns current when startTime <= now < endTime", () => {
    expect(getTimeStatus("12:00", "10:00", "14:00")).toBe("current");
  });

  it("returns current when startTime equals now", () => {
    expect(getTimeStatus("10:00", "10:00", "14:00")).toBe("current");
  });

  it("returns future when startTime > now", () => {
    expect(getTimeStatus("09:00", "10:00", "14:00")).toBe("future");
  });

  it("returns past when only startTime is set and startTime <= now", () => {
    expect(getTimeStatus("12:00", "10:00", null)).toBe("past");
  });

  it("returns future when only startTime is set and startTime > now", () => {
    expect(getTimeStatus("09:00", "10:00", null)).toBe("future");
  });

  it("handles HH:MM:SS format by comparing first 5 characters", () => {
    expect(getTimeStatus("12:00", "10:00:00", "14:00:00")).toBe("current");
  });
});

describe("compareByStartTime", () => {
  it("sorts spots with earlier startTime first", () => {
    expect(compareByStartTime({ startTime: "09:00" }, { startTime: "10:00" })).toBeLessThan(0);
  });

  it("sorts spots with later startTime after", () => {
    expect(compareByStartTime({ startTime: "14:00" }, { startTime: "09:00" })).toBeGreaterThan(0);
  });

  it("returns 0 for equal startTimes", () => {
    expect(compareByStartTime({ startTime: "09:00" }, { startTime: "09:00" })).toBe(0);
  });

  it("returns 0 when both have no startTime", () => {
    expect(compareByStartTime({ startTime: null }, { startTime: null })).toBe(0);
  });

  it("returns 0 when both startTime are undefined", () => {
    expect(compareByStartTime({}, {})).toBe(0);
  });

  it("places spot without startTime after spot with startTime", () => {
    expect(compareByStartTime({ startTime: "09:00" }, { startTime: null })).toBeLessThan(0);
  });

  it("places spot without startTime after spot with startTime (reversed)", () => {
    expect(compareByStartTime({ startTime: null }, { startTime: "09:00" })).toBeGreaterThan(0);
  });

  it("handles HH:MM:SS format", () => {
    expect(compareByStartTime({ startTime: "09:00:00" }, { startTime: "10:00:00" })).toBeLessThan(
      0,
    );
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

describe("getCrossDayTimeStatus", () => {
  it("returns past when endTime has passed", () => {
    expect(getCrossDayTimeStatus("11:00", "10:00")).toBe("past");
  });

  it("returns current when endTime has not passed", () => {
    expect(getCrossDayTimeStatus("09:00", "10:00")).toBe("current");
  });

  it("returns past when endTime equals now", () => {
    expect(getCrossDayTimeStatus("10:00", "10:00")).toBe("past");
  });

  it("returns null when endTime is null", () => {
    expect(getCrossDayTimeStatus("10:00", null)).toBeNull();
  });
});
