import type { CrossDayEntry, ScheduleResponse } from "@sugara/shared";
import { describe, expect, it } from "vitest";
import { buildMergedTimeline } from "../merge-timeline";

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

function makeCrossDayEntry(overrides: Partial<ScheduleResponse> = {}): CrossDayEntry {
  return {
    schedule: makeSchedule(overrides),
    sourceDayId: "day-1",
    sourcePatternId: "pattern-1",
    sourceDayNumber: 1,
    crossDayPosition: "final",
  };
}

function ids(items: ReturnType<typeof buildMergedTimeline>) {
  return items.map((item) =>
    item.type === "crossDay" ? `c-${item.entry.schedule.id}` : item.schedule.id,
  );
}

describe("buildMergedTimeline", () => {
  describe("empty inputs", () => {
    it("returns empty array when both schedules and cross-day entries are empty", () => {
      expect(buildMergedTimeline([], [])).toEqual([]);
    });

    it("returns empty array when crossDayEntries is undefined and schedules is empty", () => {
      expect(buildMergedTimeline([], undefined)).toEqual([]);
    });

    it("returns schedules only when crossDayEntries is undefined", () => {
      const schedules = [makeSchedule({ id: "s1" }), makeSchedule({ id: "s2" })];
      const result = buildMergedTimeline(schedules, undefined);
      expect(result).toHaveLength(2);
      expect(result.every((item) => item.type === "schedule")).toBe(true);
    });

    it("returns schedules only when crossDayEntries is empty array", () => {
      const schedules = [makeSchedule({ id: "s1" })];
      const result = buildMergedTimeline(schedules, []);
      expect(ids(result)).toEqual(["s1"]);
    });

    it("returns cross-day entries only when schedules is empty", () => {
      const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: "10:00" })];
      const result = buildMergedTimeline([], crossDayEntries);
      expect(ids(result)).toEqual(["c-c1"]);
    });

    it("returns cross-day entries (endTime null) when schedules is empty", () => {
      const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: undefined })];
      const result = buildMergedTimeline([], crossDayEntries);
      expect(ids(result)).toEqual(["c-c1"]);
    });
  });

  describe("schedules with startTime only", () => {
    it("places cross-day before schedule when endTime <= startTime", () => {
      const schedules = [makeSchedule({ id: "s1", startTime: "11:00" })];
      const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: "10:00" })];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual(["c-c1", "s1"]);
    });

    it("places cross-day exactly at boundary (endTime == startTime) before schedule", () => {
      const schedules = [makeSchedule({ id: "s1", startTime: "10:00" })];
      const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: "10:00" })];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual(["c-c1", "s1"]);
    });

    it("places cross-day after schedule when endTime > startTime", () => {
      const schedules = [makeSchedule({ id: "s1", startTime: "08:00" })];
      const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: "10:00" })];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual(["s1", "c-c1"]);
    });

    it("inserts cross-day between two time-having schedules based on endTime", () => {
      const schedules = [
        makeSchedule({ id: "s1", startTime: "08:00" }),
        makeSchedule({ id: "s2", startTime: "14:00" }),
      ];
      const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: "10:00" })];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual(["s1", "c-c1", "s2"]);
    });

    it("places cross-day with null endTime at the end of time-having schedules", () => {
      const schedules = [
        makeSchedule({ id: "s1", startTime: "09:00" }),
        makeSchedule({ id: "s2", startTime: "14:00" }),
      ];
      const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: undefined })];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual(["s1", "s2", "c-c1"]);
    });

    it("interleaves multiple cross-day entries across schedules by endTime", () => {
      const schedules = [
        makeSchedule({ id: "s1", startTime: "09:00" }),
        makeSchedule({ id: "s2", startTime: "15:00" }),
      ];
      const crossDayEntries = [
        makeCrossDayEntry({ id: "c1", endTime: "08:00" }),
        makeCrossDayEntry({ id: "c2", endTime: "12:00" }),
      ];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual([
        "c-c1",
        "s1",
        "c-c2",
        "s2",
      ]);
    });

    it("sorts multiple cross-day entries by endTime when flushed before the same schedule", () => {
      const schedules = [makeSchedule({ id: "s1", startTime: "14:00" })];
      const crossDayEntries = [
        makeCrossDayEntry({ id: "c-late", endTime: "10:00" }),
        makeCrossDayEntry({ id: "c-early", endTime: "08:00" }),
      ];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual([
        "c-c-early",
        "c-c-late",
        "s1",
      ]);
    });

    it("preserves source order for cross-day entries that have identical endTime", () => {
      const schedules = [makeSchedule({ id: "s1", startTime: "12:00" })];
      const crossDayEntries = [
        { ...makeCrossDayEntry({ id: "c1", endTime: "10:00" }), sourceDayId: "day-1" },
        { ...makeCrossDayEntry({ id: "c2", endTime: "10:00" }), sourceDayId: "day-2" },
      ];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual(["c-c1", "c-c2", "s1"]);
    });
  });

  describe("schedules with null startTime (no time anchor)", () => {
    // Why: a schedule without startTime has no comparable time, so it must
    // not determine the position of cross-day entries. Cross-day entries are
    // positioned purely by endTime against time-having schedules; null-time
    // schedules flow around them by sortOrder.

    it("places cross-day (endTime) at the end when only null-startTime schedules exist", () => {
      const schedules = [
        makeSchedule({ id: "s1", startTime: undefined }),
        makeSchedule({ id: "s2", startTime: undefined }),
      ];
      const crossDayEntries = [
        makeCrossDayEntry({ id: "c1", endTime: "10:00" }),
        makeCrossDayEntry({ id: "c2", endTime: "08:00" }),
      ];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual([
        "s1",
        "s2",
        "c-c2",
        "c-c1",
      ]);
    });

    it("places cross-day at end after a single null-startTime schedule", () => {
      const schedules = [makeSchedule({ id: "s1", startTime: undefined })];
      const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: "10:00" })];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual(["s1", "c-c1"]);
    });

    it("keeps cross-day (endTime null) at end even when schedule has null startTime", () => {
      const schedules = [makeSchedule({ id: "s1", startTime: undefined })];
      const crossDayEntries = [makeCrossDayEntry({ id: "c1", endTime: undefined })];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual(["s1", "c-c1"]);
    });

    it("places both endTime and null-endTime cross-day after null-startTime schedule", () => {
      const schedules = [makeSchedule({ id: "s1", startTime: undefined })];
      const crossDayEntries = [
        makeCrossDayEntry({ id: "c-with-end", endTime: "10:00" }),
        makeCrossDayEntry({ id: "c-without-end", endTime: undefined }),
      ];
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual([
        "s1",
        "c-c-with-end",
        "c-c-without-end",
      ]);
    });
  });

  describe("mixed null-startTime and time-having schedules", () => {
    it("keeps null-startTime schedule before cross-day when time-having schedule follows (user scenario)", () => {
      // Scenario from the 奥多摩 trip: [奥多摩駅から奥多摩湖(null), 奥多摩湖(09:15),
      // 奥多摩湖から奥多摩駅(10:22)] with cross-day [玉翠荘 08:50]. The cross-day
      // must land between the null-startTime schedule and the 09:15 schedule.
      const schedules = [
        makeSchedule({ id: "s-null", startTime: undefined, sortOrder: 0 }),
        makeSchedule({ id: "s-915", startTime: "09:15", sortOrder: 1 }),
        makeSchedule({ id: "s-1022", startTime: "10:22", sortOrder: 2 }),
      ];
      const crossDayEntries = [makeCrossDayEntry({ id: "c-0850", endTime: "08:50" })];

      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual([
        "s-null",
        "c-c-0850",
        "s-915",
        "s-1022",
      ]);
    });

    it("places cross-day between null-startTime-led group and time-having schedule when endTime is earlier", () => {
      const schedules = [
        makeSchedule({ id: "s-null", startTime: undefined }),
        makeSchedule({ id: "s-10", startTime: "10:00" }),
      ];
      const crossDayEntries = [makeCrossDayEntry({ id: "c-09", endTime: "09:00" })];

      // null-startTime does not flush crossDay; the 10:00 schedule does.
      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual([
        "s-null",
        "c-c-09",
        "s-10",
      ]);
    });

    it("leaves cross-day at end when remaining schedules after time-having are null-startTime only", () => {
      // [s 09:00, s null] + cross-day endTime 10:00
      // 09:00 < 10:00 so no flush at s-09; null does not flush; residual → end.
      const schedules = [
        makeSchedule({ id: "s-09", startTime: "09:00" }),
        makeSchedule({ id: "s-null", startTime: undefined }),
      ];
      const crossDayEntries = [makeCrossDayEntry({ id: "c-10", endTime: "10:00" })];

      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual([
        "s-09",
        "s-null",
        "c-c-10",
      ]);
    });

    it("places cross-day before first time-having schedule even when preceded by null-startTime", () => {
      const schedules = [
        makeSchedule({ id: "s-null", startTime: undefined }),
        makeSchedule({ id: "s-14", startTime: "14:00" }),
      ];
      const crossDayEntries = [makeCrossDayEntry({ id: "c-08", endTime: "08:00" })];

      expect(ids(buildMergedTimeline(schedules, crossDayEntries))).toEqual([
        "s-null",
        "c-c-08",
        "s-14",
      ]);
    });

    it("places early-morning schedule before hotel checkout crossDay (breakfast scenario)", () => {
      // 朝食 07:00 をホテルのチェックアウト crossDay ~11:00 がある Day に入れた場合、
      // 時刻順で朝食が crossDay より前に来ることを確認する。
      const breakfast = makeSchedule({ id: "breakfast", startTime: "07:00", sortOrder: 0 });
      const sightseeing = makeSchedule({ id: "sightseeing", startTime: "13:00", sortOrder: 1 });
      const checkout = makeCrossDayEntry({ id: "checkout", endTime: "11:00" });

      expect(ids(buildMergedTimeline([breakfast, sightseeing], [checkout]))).toEqual([
        "breakfast",
        "c-checkout",
        "sightseeing",
      ]);
    });

    it("keeps crossDay at the end when every time-having schedule is earlier than the crossDay endTime", () => {
      // 朝食 07:00 が唯一の time-having schedule で、crossDay が 11:00 のケース。
      // crossDay を flush するタイミングがないため末尾に残る（= 朝食の後 = 時刻順で自然）。
      const breakfast = makeSchedule({ id: "breakfast", startTime: "07:00", sortOrder: 0 });
      const checkout = makeCrossDayEntry({ id: "checkout", endTime: "11:00" });

      expect(ids(buildMergedTimeline([breakfast], [checkout]))).toEqual([
        "breakfast",
        "c-checkout",
      ]);
    });
  });
});
