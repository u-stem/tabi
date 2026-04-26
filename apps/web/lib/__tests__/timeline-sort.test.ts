import type { ScheduleResponse } from "@sugara/shared";
import { describe, expect, it } from "vitest";
import { isScheduleListSorted } from "../timeline-sort";

function makeSchedule(overrides: Partial<ScheduleResponse> = {}): ScheduleResponse {
  return {
    id: "s-default",
    name: "Default",
    category: "sightseeing",
    color: "blue",
    urls: [],
    sortOrder: 0,
    updatedAt: "",
    ...overrides,
  };
}

describe("isScheduleListSorted", () => {
  describe("trivial cases", () => {
    it("returns true for empty list", () => {
      expect(isScheduleListSorted([])).toBe(true);
    });

    it("returns true for single-element list regardless of anchor or time", () => {
      expect(isScheduleListSorted([makeSchedule({ startTime: "09:00" })])).toBe(true);
    });
  });

  describe("time order without anchors", () => {
    it("returns true when start times are strictly ascending", () => {
      const schedules = [
        makeSchedule({ id: "a", startTime: "09:00" }),
        makeSchedule({ id: "b", startTime: "10:00" }),
        makeSchedule({ id: "c", startTime: "13:00" }),
      ];
      expect(isScheduleListSorted(schedules)).toBe(true);
    });

    it("returns true when consecutive start times are equal", () => {
      const schedules = [
        makeSchedule({ id: "a", startTime: "09:00" }),
        makeSchedule({ id: "b", startTime: "09:00" }),
      ];
      expect(isScheduleListSorted(schedules)).toBe(true);
    });

    it("returns false when start times are descending", () => {
      const schedules = [
        makeSchedule({ id: "a", startTime: "12:00" }),
        makeSchedule({ id: "b", startTime: "09:00" }),
      ];
      expect(isScheduleListSorted(schedules)).toBe(false);
    });

    it("returns false when a single pair is out of order in an otherwise sorted list", () => {
      const schedules = [
        makeSchedule({ id: "a", startTime: "09:00" }),
        makeSchedule({ id: "b", startTime: "12:00" }),
        makeSchedule({ id: "c", startTime: "10:00" }),
      ];
      expect(isScheduleListSorted(schedules)).toBe(false);
    });
  });

  describe("null startTime handling", () => {
    it("returns true when a trailing entry has null startTime (null sorts last)", () => {
      const schedules = [
        makeSchedule({ id: "a", startTime: "09:00" }),
        makeSchedule({ id: "b", startTime: null }),
      ];
      expect(isScheduleListSorted(schedules)).toBe(true);
    });

    it("returns false when a null-startTime entry appears before a timed entry", () => {
      const schedules = [
        makeSchedule({ id: "a", startTime: null }),
        makeSchedule({ id: "b", startTime: "09:00" }),
      ];
      expect(isScheduleListSorted(schedules)).toBe(false);
    });

    it("returns true when all entries have null startTime", () => {
      const schedules = [
        makeSchedule({ id: "a", startTime: null }),
        makeSchedule({ id: "b", startTime: null }),
      ];
      expect(isScheduleListSorted(schedules)).toBe(true);
    });
  });

  describe("anchor handling", () => {
    it("returns false when any schedule carries a valid cross-day anchor, even if times are sorted", () => {
      const schedules = [
        makeSchedule({ id: "a", startTime: "09:00" }),
        makeSchedule({
          id: "b",
          startTime: "10:00",
          crossDayAnchor: "before",
          crossDayAnchorSourceId: "x-source",
        }),
      ];
      expect(isScheduleListSorted(schedules)).toBe(false);
    });

    it("treats anchor as absent when crossDayAnchorSourceId is missing", () => {
      const schedules = [
        makeSchedule({ id: "a", startTime: "09:00" }),
        makeSchedule({
          id: "b",
          startTime: "10:00",
          crossDayAnchor: "before",
          crossDayAnchorSourceId: null,
        }),
      ];
      expect(isScheduleListSorted(schedules)).toBe(true);
    });

    it("treats anchor as absent when crossDayAnchor is null even with sourceId set", () => {
      const schedules = [
        makeSchedule({ id: "a", startTime: "09:00" }),
        makeSchedule({
          id: "b",
          startTime: "10:00",
          crossDayAnchor: null,
          crossDayAnchorSourceId: "x-source",
        }),
      ];
      expect(isScheduleListSorted(schedules)).toBe(true);
    });
  });
});
