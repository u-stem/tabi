import type { DayResponse, ScheduleResponse } from "@sugara/shared";
import { describe, expect, it } from "vitest";
import { getCrossDayEntries } from "../cross-day";

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

function makeDays(overrides: Partial<DayResponse>[] = []): DayResponse[] {
  const defaults: DayResponse[] = [
    {
      id: "day-1",
      dayNumber: 1,
      date: "2025-04-01",
      patterns: [
        { id: "pattern-1", label: "Default", isDefault: true, sortOrder: 0, schedules: [] },
      ],
    },
    {
      id: "day-2",
      dayNumber: 2,
      date: "2025-04-02",
      patterns: [
        { id: "pattern-2", label: "Default", isDefault: true, sortOrder: 0, schedules: [] },
      ],
    },
    {
      id: "day-3",
      dayNumber: 3,
      date: "2025-04-03",
      patterns: [
        { id: "pattern-3", label: "Default", isDefault: true, sortOrder: 0, schedules: [] },
      ],
    },
  ];
  return defaults.map((d, i) => ({ ...d, ...overrides[i] }));
}

describe("getCrossDayEntries", () => {
  it("returns entry on next day when endDayOffset is 1", () => {
    const days = makeDays();
    const schedule = makeSchedule({
      id: "s1",
      name: "Hotel A",
      category: "hotel",
      endTime: "10:00",
      endDayOffset: 1,
    });
    days[0].patterns[0].schedules = [schedule];

    const entries = getCrossDayEntries(days, 2);

    expect(entries).toHaveLength(1);
    expect(entries[0].schedule).toBe(schedule);
    expect(entries[0].sourceDayId).toBe("day-1");
    expect(entries[0].sourcePatternId).toBe("pattern-1");
    expect(entries[0].sourceDayNumber).toBe(1);
  });

  it("returns empty array when schedule has no endDayOffset", () => {
    const days = makeDays();
    days[0].patterns[0].schedules = [
      makeSchedule({ id: "s1", name: "Hotel A", category: "hotel", endTime: "10:00" }),
    ];

    const entries = getCrossDayEntries(days, 2);

    expect(entries).toHaveLength(0);
  });

  it("returns entry 2 days later when endDayOffset is 2", () => {
    const days = makeDays();
    days[0].patterns[0].schedules = [
      makeSchedule({
        id: "s1",
        name: "Long Stay",
        category: "hotel",
        endTime: "11:00",
        endDayOffset: 2,
      }),
    ];

    const entries = getCrossDayEntries(days, 3);

    expect(entries).toHaveLength(1);
    expect(entries[0].schedule.id).toBe("s1");
  });

  it("returns empty array when target day has no matching entries", () => {
    const days = makeDays();
    days[0].patterns[0].schedules = [
      makeSchedule({
        id: "s1",
        name: "Hotel A",
        category: "hotel",
        endTime: "10:00",
        endDayOffset: 1,
      }),
    ];

    const entries = getCrossDayEntries(days, 1);

    expect(entries).toHaveLength(0);
  });

  it("collects entries across multiple patterns", () => {
    const days = makeDays();
    days[0].patterns = [
      {
        id: "pattern-a",
        label: "A",
        isDefault: true,
        sortOrder: 0,
        schedules: [
          makeSchedule({
            id: "s1",
            name: "Hotel A",
            category: "hotel",
            endTime: "10:00",
            endDayOffset: 1,
          }),
        ],
      },
      {
        id: "pattern-b",
        label: "B",
        isDefault: false,
        sortOrder: 1,
        schedules: [
          makeSchedule({
            id: "s2",
            name: "Night Bus",
            category: "transport",
            endTime: "06:00",
            color: "red",
            endDayOffset: 1,
          }),
        ],
      },
    ];

    const entries = getCrossDayEntries(days, 2);

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.schedule.id)).toEqual(["s1", "s2"]);
  });
});
