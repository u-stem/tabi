import type { CrossDayEntry, ScheduleResponse } from "@sugara/shared";
import { describe, expect, it } from "vitest";
import { buildMergedTimeline } from "../merge-timeline";

function makeSchedule(overrides: Partial<ScheduleResponse> = {}): ScheduleResponse {
  return {
    id: "s-default",
    name: "Default",
    category: "sightseeing",
    color: "blue",
    sortOrder: 0,
    updatedAt: "",
    ...overrides,
  };
}

function makeCrossDayEntry(overrides: Partial<ScheduleResponse> = {}): CrossDayEntry {
  return {
    schedule: makeSchedule(overrides),
    sourceDayId: "day-1",
    sourcePatternId: "pattern-1",
    sourceDayNumber: 1,
  };
}

describe("buildMergedTimeline", () => {
  it("returns schedules only when no cross-day entries", () => {
    const schedules = [makeSchedule({ id: "s1" }), makeSchedule({ id: "s2" })];

    const result = buildMergedTimeline(schedules, undefined);

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.type === "schedule")).toBe(true);
  });

  it("returns schedules only when cross-day entries is empty array", () => {
    const schedules = [makeSchedule({ id: "s1" })];

    const result = buildMergedTimeline(schedules, []);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("schedule");
  });

  it("inserts cross-day entry before schedule with later startTime", () => {
    const schedules = [makeSchedule({ id: "s1", startTime: "11:00" })];
    const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: "10:00" })];

    const result = buildMergedTimeline(schedules, crossDayEntries);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("crossDay");
    expect(result[1].type).toBe("schedule");
  });

  it("places cross-day entry after schedule with earlier startTime", () => {
    const schedules = [
      makeSchedule({ id: "s1", startTime: "08:00" }),
      makeSchedule({ id: "s2", startTime: "14:00" }),
    ];
    const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: "10:00" })];

    const result = buildMergedTimeline(schedules, crossDayEntries);

    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("schedule");
    expect(result[1].type).toBe("crossDay");
    expect(result[2].type).toBe("schedule");
  });

  it("places cross-day entry with null endTime at the end", () => {
    const schedules = [
      makeSchedule({ id: "s1", startTime: "09:00" }),
      makeSchedule({ id: "s2", startTime: "14:00" }),
    ];
    const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: undefined })];

    const result = buildMergedTimeline(schedules, crossDayEntries);

    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("schedule");
    expect(result[1].type).toBe("schedule");
    expect(result[2].type).toBe("crossDay");
  });

  it("places all cross-day entries at end when all schedules have null startTime", () => {
    const schedules = [
      makeSchedule({ id: "s1", startTime: undefined }),
      makeSchedule({ id: "s2", startTime: undefined }),
    ];
    const crossDayEntries = [
      makeCrossDayEntry({ id: "c1", endTime: "10:00" }),
      makeCrossDayEntry({ id: "c2", endTime: "08:00" }),
    ];

    const result = buildMergedTimeline(schedules, crossDayEntries);

    expect(result).toHaveLength(4);
    expect(result[0].type).toBe("schedule");
    expect(result[1].type).toBe("schedule");
    expect(result[2].type).toBe("crossDay");
    expect(result[3].type).toBe("crossDay");
  });

  it("handles multiple cross-day entries with different endTimes", () => {
    const schedules = [
      makeSchedule({ id: "s1", startTime: "09:00" }),
      makeSchedule({ id: "s2", startTime: "15:00" }),
    ];
    const crossDayEntries = [
      makeCrossDayEntry({ id: "c1", endTime: "08:00" }),
      makeCrossDayEntry({ id: "c2", endTime: "12:00" }),
    ];

    const result = buildMergedTimeline(schedules, crossDayEntries);

    expect(result).toHaveLength(4);
    expect(
      result.map((item) =>
        item.type === "schedule"
          ? item.schedule.id
          : `cross-${(item as { type: "crossDay"; entry: CrossDayEntry }).entry.schedule.id}`,
      ),
    ).toEqual(["cross-c1", "s1", "cross-c2", "s2"]);
  });

  it("preserves order of cross-day entries with the same endTime", () => {
    const schedules = [makeSchedule({ id: "s1", startTime: "12:00" })];
    const crossDayEntries = [
      { ...makeCrossDayEntry({ id: "c1", endTime: "10:00" }), sourceDayId: "day-1" },
      { ...makeCrossDayEntry({ id: "c2", endTime: "10:00" }), sourceDayId: "day-2" },
    ];

    const result = buildMergedTimeline(schedules, crossDayEntries);

    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("crossDay");
    expect(result[1].type).toBe("crossDay");
    const first = result[0] as { type: "crossDay"; entry: CrossDayEntry };
    const second = result[1] as { type: "crossDay"; entry: CrossDayEntry };
    expect(first.entry.schedule.id).toBe("c1");
    expect(second.entry.schedule.id).toBe("c2");
  });

  it("sorts multiple cross-day entries by endTime when inserted before the same schedule", () => {
    const schedules = [makeSchedule({ id: "s1", startTime: "14:00" })];
    const crossDayEntries = [
      makeCrossDayEntry({ id: "c-late", endTime: "10:00" }),
      makeCrossDayEntry({ id: "c-early", endTime: "08:00" }),
    ];

    const result = buildMergedTimeline(schedules, crossDayEntries);

    expect(result).toHaveLength(3);
    const ids = result.map((item) =>
      item.type === "crossDay" ? item.entry.schedule.id : item.schedule.id,
    );
    expect(ids).toEqual(["c-early", "c-late", "s1"]);
  });

  it("returns only cross-day entries when schedules is empty", () => {
    const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: "10:00" })];

    const result = buildMergedTimeline([], crossDayEntries);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("crossDay");
  });
});
