import type { DayResponse, ScheduleResponse } from "@sugara/shared";
import { describe, expect, it } from "vitest";
import { getCrossDayEntries } from "../cross-day";

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
    {
      id: "day-4",
      dayNumber: 4,
      date: "2025-04-04",
      patterns: [
        { id: "pattern-4", label: "Default", isDefault: true, sortOrder: 0, schedules: [] },
      ],
    },
  ];
  return defaults.map((d, i) => ({ ...d, ...overrides[i] }));
}

describe("getCrossDayEntries", () => {
  it("returns final entry on next day when endDayOffset is 1", () => {
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
    expect(entries[0].crossDayPosition).toBe("final");
  });

  it("returns empty array when schedule has no endDayOffset", () => {
    const days = makeDays();
    days[0].patterns[0].schedules = [
      makeSchedule({ id: "s1", name: "Hotel A", category: "hotel", endTime: "10:00" }),
    ];

    const entries = getCrossDayEntries(days, 2);

    expect(entries).toHaveLength(0);
  });

  it("returns final entry 2 days later when endDayOffset is 2", () => {
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
    expect(entries[0].crossDayPosition).toBe("final");
  });

  it("returns intermediate entry for middle days of multi-day span", () => {
    const days = makeDays();
    days[0].patterns[0].schedules = [
      makeSchedule({
        id: "s1",
        name: "Long Stay",
        category: "hotel",
        endTime: "11:00",
        endDayOffset: 3,
      }),
    ];

    const day2Entries = getCrossDayEntries(days, 2);
    expect(day2Entries).toHaveLength(1);
    expect(day2Entries[0].crossDayPosition).toBe("intermediate");

    const day3Entries = getCrossDayEntries(days, 3);
    expect(day3Entries).toHaveLength(1);
    expect(day3Entries[0].crossDayPosition).toBe("intermediate");

    const day4Entries = getCrossDayEntries(days, 4);
    expect(day4Entries).toHaveLength(1);
    expect(day4Entries[0].crossDayPosition).toBe("final");
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
    expect(entries[0].crossDayPosition).toBe("final");
    expect(entries[1].crossDayPosition).toBe("final");
  });
});

describe("getCrossDayEntries with parallel patterns", () => {
  it("filters source patterns by viewing pattern sortOrder when source day has multiple patterns", () => {
    // Why: parallel candidate patterns (sunny/rainy) should be independent.
    // The rainy pattern viewer must not see the sunny pattern's hotel.
    const days: DayResponse[] = [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2025-04-01",
        patterns: [
          {
            id: "p1a",
            label: "晴れ",
            isDefault: true,
            sortOrder: 0,
            schedules: [
              makeSchedule({
                id: "hotel-sunny",
                category: "hotel",
                endTime: "10:00",
                endDayOffset: 1,
              }),
            ],
          },
          {
            id: "p1b",
            label: "雨",
            isDefault: false,
            sortOrder: 1,
            schedules: [
              makeSchedule({
                id: "hotel-rainy",
                category: "hotel",
                endTime: "11:00",
                endDayOffset: 1,
              }),
            ],
          },
        ],
      },
      {
        id: "day-2",
        dayNumber: 2,
        date: "2025-04-02",
        patterns: [
          { id: "p2a", label: "晴れ", isDefault: true, sortOrder: 0, schedules: [] },
          { id: "p2b", label: "雨", isDefault: false, sortOrder: 1, schedules: [] },
        ],
      },
    ];

    const sunnyEntries = getCrossDayEntries(days, 2, 0);
    expect(sunnyEntries.map((e) => e.schedule.id)).toEqual(["hotel-sunny"]);

    const rainyEntries = getCrossDayEntries(days, 2, 1);
    expect(rainyEntries.map((e) => e.schedule.id)).toEqual(["hotel-rainy"]);
  });

  it("includes the sole pattern's crossDays for every viewing pattern when source day is pre-branch", () => {
    const days: DayResponse[] = [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2025-04-01",
        patterns: [
          {
            id: "p1",
            label: "Default",
            isDefault: true,
            sortOrder: 0,
            schedules: [
              makeSchedule({
                id: "shared-hotel",
                category: "hotel",
                endTime: "10:00",
                endDayOffset: 1,
              }),
            ],
          },
        ],
      },
      {
        id: "day-2",
        dayNumber: 2,
        date: "2025-04-02",
        patterns: [
          { id: "p2a", label: "晴れ", isDefault: true, sortOrder: 0, schedules: [] },
          { id: "p2b", label: "雨", isDefault: false, sortOrder: 1, schedules: [] },
        ],
      },
    ];

    expect(getCrossDayEntries(days, 2, 0).map((e) => e.schedule.id)).toEqual(["shared-hotel"]);
    expect(getCrossDayEntries(days, 2, 1).map((e) => e.schedule.id)).toEqual(["shared-hotel"]);
  });

  it("falls back to default pattern when viewing pattern sortOrder is absent in source day", () => {
    const days: DayResponse[] = [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2025-04-01",
        patterns: [
          {
            id: "p1a",
            label: "Default",
            isDefault: true,
            sortOrder: 0,
            schedules: [
              makeSchedule({
                id: "default-hotel",
                category: "hotel",
                endTime: "10:00",
                endDayOffset: 1,
              }),
            ],
          },
          {
            id: "p1b",
            label: "Alt",
            isDefault: false,
            sortOrder: 2,
            schedules: [
              makeSchedule({
                id: "alt-hotel",
                category: "hotel",
                endTime: "11:00",
                endDayOffset: 1,
              }),
            ],
          },
        ],
      },
      {
        id: "day-2",
        dayNumber: 2,
        date: "2025-04-02",
        patterns: [
          { id: "p2a", label: "Default", isDefault: true, sortOrder: 0, schedules: [] },
          { id: "p2b", label: "雨", isDefault: false, sortOrder: 1, schedules: [] },
        ],
      },
    ];

    // Viewing sortOrder=1 ("雨") has no match in source day (which has 0 and 2).
    // Fall back to source default pattern (sortOrder=0).
    expect(getCrossDayEntries(days, 2, 1).map((e) => e.schedule.id)).toEqual(["default-hotel"]);
  });

  it("returns all patterns' crossDays when viewingPatternSortOrder is undefined", () => {
    // Legacy callers that don't specify a viewing pattern receive all
    // crossDays, matching the pre-filter behavior.
    const days: DayResponse[] = [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2025-04-01",
        patterns: [
          {
            id: "p1a",
            label: "A",
            isDefault: true,
            sortOrder: 0,
            schedules: [
              makeSchedule({ id: "a", category: "hotel", endTime: "10:00", endDayOffset: 1 }),
            ],
          },
          {
            id: "p1b",
            label: "B",
            isDefault: false,
            sortOrder: 1,
            schedules: [
              makeSchedule({ id: "b", category: "hotel", endTime: "10:00", endDayOffset: 1 }),
            ],
          },
        ],
      },
      {
        id: "day-2",
        dayNumber: 2,
        date: "2025-04-02",
        patterns: [{ id: "p2", label: "Default", isDefault: true, sortOrder: 0, schedules: [] }],
      },
    ];

    const entries = getCrossDayEntries(days, 2);
    expect(entries.map((e) => e.schedule.id).sort()).toEqual(["a", "b"]);
  });
});
