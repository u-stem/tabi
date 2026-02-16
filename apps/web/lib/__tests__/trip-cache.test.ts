import type {
  CandidateResponse,
  DayPatternResponse,
  DayResponse,
  ScheduleResponse,
  TripResponse,
} from "@sugara/shared";
import { describe, expect, it } from "vitest";
import {
  addCandidate,
  addScheduleToPattern,
  moveCandidateToSchedule,
  moveScheduleToCandidate,
  removeCandidate,
  removeScheduleFromPattern,
  toCandidateResponse,
  toScheduleResponse,
  updateCandidate,
  updateScheduleInPattern,
} from "../trip-cache";

function makeSchedule(overrides: Partial<ScheduleResponse> = {}): ScheduleResponse {
  return {
    id: "s1",
    name: "Schedule 1",
    category: "sightseeing",
    color: "blue",
    urls: [],
    sortOrder: 0,
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<CandidateResponse> = {}): CandidateResponse {
  return {
    ...makeSchedule({ id: "c1", name: "Candidate 1" }),
    likeCount: 0,
    hmmCount: 0,
    myReaction: null,
    ...overrides,
  };
}

function makePattern(overrides: Partial<DayPatternResponse> = {}): DayPatternResponse {
  return {
    id: "p1",
    label: "Default",
    isDefault: true,
    sortOrder: 0,
    schedules: [],
    ...overrides,
  };
}

function makeDay(overrides: Partial<DayResponse> = {}): DayResponse {
  return {
    id: "d1",
    dayNumber: 1,
    date: "2025-04-01",
    patterns: [makePattern()],
    ...overrides,
  };
}

function makeTrip(overrides: Partial<TripResponse> = {}): TripResponse {
  return {
    id: "trip1",
    title: "Test Trip",
    destination: "Tokyo",
    startDate: "2025-04-01",
    endDate: "2025-04-03",
    status: "planned",
    role: "owner",
    days: [makeDay()],
    candidates: [],
    scheduleCount: 0,
    memberCount: 1,
    ...overrides,
  };
}

// --- toScheduleResponse ---

describe("toScheduleResponse", () => {
  it("extracts ScheduleResponse fields from a DB row", () => {
    const raw = {
      id: "s1",
      name: "Test",
      category: "sightseeing" as const,
      color: "blue" as const,
      address: "Tokyo",
      startTime: "09:00",
      endTime: "10:00",
      sortOrder: 1,
      memo: "note",
      urls: ["https://example.com"],
      departurePlace: null,
      arrivalPlace: null,
      transportMethod: null,
      endDayOffset: null,
      updatedAt: "2025-01-01T00:00:00Z",
      // Extra DB fields that should be stripped
      tripId: "trip1",
      dayPatternId: "p1",
      createdAt: "2025-01-01T00:00:00Z",
    };

    const result = toScheduleResponse(raw);

    expect(result).toEqual({
      id: "s1",
      name: "Test",
      category: "sightseeing",
      color: "blue",
      address: "Tokyo",
      startTime: "09:00",
      endTime: "10:00",
      sortOrder: 1,
      memo: "note",
      urls: ["https://example.com"],
      departurePlace: null,
      arrivalPlace: null,
      transportMethod: null,
      endDayOffset: null,
      updatedAt: "2025-01-01T00:00:00Z",
    });
    expect(result).not.toHaveProperty("tripId");
    expect(result).not.toHaveProperty("dayPatternId");
  });
});

// --- toCandidateResponse ---

describe("toCandidateResponse", () => {
  it("creates CandidateResponse with zero counts and null reaction", () => {
    const raw = {
      id: "c1",
      name: "Candidate",
      category: "food" as const,
      color: "red" as const,
      sortOrder: 0,
      urls: [],
      updatedAt: "2025-01-01T00:00:00Z",
    };

    const result = toCandidateResponse(raw);

    expect(result.likeCount).toBe(0);
    expect(result.hmmCount).toBe(0);
    expect(result.myReaction).toBeNull();
    expect(result.id).toBe("c1");
  });
});

// --- addScheduleToPattern ---

describe("addScheduleToPattern", () => {
  it("adds a schedule to the specified pattern and increments scheduleCount", () => {
    const schedule = makeSchedule();
    const trip = makeTrip({ scheduleCount: 2 });

    const result = addScheduleToPattern(trip, "d1", "p1", schedule);

    expect(result.days[0].patterns[0].schedules).toEqual([schedule]);
    expect(result.scheduleCount).toBe(3);
  });

  it("returns unchanged trip if day not found", () => {
    const trip = makeTrip();
    const result = addScheduleToPattern(trip, "nonexistent", "p1", makeSchedule());

    expect(result).toBe(trip);
  });

  it("returns unchanged trip if pattern not found", () => {
    const trip = makeTrip();
    const result = addScheduleToPattern(trip, "d1", "nonexistent", makeSchedule());

    expect(result).toBe(trip);
  });
});

// --- updateScheduleInPattern ---

describe("updateScheduleInPattern", () => {
  it("replaces the matching schedule in the pattern", () => {
    const original = makeSchedule({ name: "Old" });
    const updated = makeSchedule({ name: "New" });
    const trip = makeTrip({
      days: [makeDay({ patterns: [makePattern({ schedules: [original] })] })],
    });

    const result = updateScheduleInPattern(trip, "d1", "p1", "s1", updated);

    expect(result.days[0].patterns[0].schedules[0].name).toBe("New");
  });

  it("does not change scheduleCount", () => {
    const original = makeSchedule();
    const trip = makeTrip({
      scheduleCount: 5,
      days: [makeDay({ patterns: [makePattern({ schedules: [original] })] })],
    });

    const result = updateScheduleInPattern(trip, "d1", "p1", "s1", makeSchedule({ name: "X" }));

    expect(result.scheduleCount).toBe(5);
  });
});

// --- removeScheduleFromPattern ---

describe("removeScheduleFromPattern", () => {
  it("removes the schedule and decrements scheduleCount", () => {
    const schedule = makeSchedule();
    const trip = makeTrip({
      scheduleCount: 3,
      days: [makeDay({ patterns: [makePattern({ schedules: [schedule] })] })],
    });

    const result = removeScheduleFromPattern(trip, "d1", "p1", "s1");

    expect(result.days[0].patterns[0].schedules).toEqual([]);
    expect(result.scheduleCount).toBe(2);
  });

  it("returns unchanged trip if schedule not found", () => {
    const trip = makeTrip({
      days: [makeDay({ patterns: [makePattern({ schedules: [makeSchedule()] })] })],
    });

    const result = removeScheduleFromPattern(trip, "d1", "p1", "nonexistent");

    expect(result).toBe(trip);
  });
});

// --- addCandidate ---

describe("addCandidate", () => {
  it("appends candidate and increments scheduleCount", () => {
    const candidate = makeCandidate();
    const trip = makeTrip({ scheduleCount: 1 });

    const result = addCandidate(trip, candidate);

    expect(result.candidates).toEqual([candidate]);
    expect(result.scheduleCount).toBe(2);
  });
});

// --- updateCandidate ---

describe("updateCandidate", () => {
  it("replaces the matching candidate while preserving reaction data", () => {
    const existing = makeCandidate({ likeCount: 5, hmmCount: 2, myReaction: "like" });
    const updated = makeCandidate({ name: "Updated Name", likeCount: 0, hmmCount: 0 });
    const trip = makeTrip({ candidates: [existing] });

    const result = updateCandidate(trip, "c1", updated);

    expect(result.candidates[0].name).toBe("Updated Name");
    expect(result.candidates[0].likeCount).toBe(5);
    expect(result.candidates[0].hmmCount).toBe(2);
    expect(result.candidates[0].myReaction).toBe("like");
  });
});

// --- removeCandidate ---

describe("removeCandidate", () => {
  it("removes the candidate and decrements scheduleCount", () => {
    const candidate = makeCandidate();
    const trip = makeTrip({ scheduleCount: 2, candidates: [candidate] });

    const result = removeCandidate(trip, "c1");

    expect(result.candidates).toEqual([]);
    expect(result.scheduleCount).toBe(1);
  });

  it("returns unchanged trip if candidate not found", () => {
    const trip = makeTrip({ candidates: [makeCandidate()] });

    const result = removeCandidate(trip, "nonexistent");

    expect(result).toBe(trip);
  });
});

// --- moveScheduleToCandidate ---

describe("moveScheduleToCandidate", () => {
  it("moves schedule from pattern to candidates", () => {
    const schedule = makeSchedule({ id: "s1", name: "Move me" });
    const trip = makeTrip({
      scheduleCount: 3,
      days: [makeDay({ patterns: [makePattern({ schedules: [schedule] })] })],
      candidates: [],
    });

    const result = moveScheduleToCandidate(trip, "d1", "p1", "s1");

    expect(result.days[0].patterns[0].schedules).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].id).toBe("s1");
    expect(result.candidates[0].likeCount).toBe(0);
    expect(result.candidates[0].hmmCount).toBe(0);
    expect(result.candidates[0].myReaction).toBeNull();
    expect(result.scheduleCount).toBe(3);
  });

  it("uses serverData for sortOrder/updatedAt when provided", () => {
    const schedule = makeSchedule({ id: "s1", sortOrder: 0, updatedAt: "old" });
    const serverData = makeSchedule({ id: "s1", sortOrder: 99, updatedAt: "new" });
    const trip = makeTrip({
      days: [makeDay({ patterns: [makePattern({ schedules: [schedule] })] })],
    });

    const result = moveScheduleToCandidate(trip, "d1", "p1", "s1", serverData);

    expect(result.candidates[0].sortOrder).toBe(99);
    expect(result.candidates[0].updatedAt).toBe("new");
  });
});

// --- moveCandidateToSchedule ---

describe("moveCandidateToSchedule", () => {
  it("moves candidate from candidates to a pattern", () => {
    const candidate = makeCandidate({ id: "c1", name: "Assign me" });
    const trip = makeTrip({
      scheduleCount: 2,
      days: [makeDay({ patterns: [makePattern({ schedules: [] })] })],
      candidates: [candidate],
    });

    const result = moveCandidateToSchedule(trip, "c1", "d1", "p1");

    expect(result.candidates).toEqual([]);
    expect(result.days[0].patterns[0].schedules).toHaveLength(1);
    expect(result.days[0].patterns[0].schedules[0].id).toBe("c1");
    expect(result.days[0].patterns[0].schedules[0]).not.toHaveProperty("likeCount");
    expect(result.scheduleCount).toBe(2);
  });

  it("uses serverData for sortOrder/updatedAt when provided", () => {
    const candidate = makeCandidate({ id: "c1", sortOrder: 0, updatedAt: "old" });
    const serverData = makeSchedule({ id: "c1", sortOrder: 42, updatedAt: "new" });
    const trip = makeTrip({
      days: [makeDay({ patterns: [makePattern({ schedules: [] })] })],
      candidates: [candidate],
    });

    const result = moveCandidateToSchedule(trip, "c1", "d1", "p1", serverData);

    expect(result.days[0].patterns[0].schedules[0].sortOrder).toBe(42);
    expect(result.days[0].patterns[0].schedules[0].updatedAt).toBe("new");
  });
});
