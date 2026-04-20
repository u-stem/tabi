import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbQuery = vi.hoisted(() => ({
  tripMembers: { findFirst: vi.fn() },
  tripDays: { findFirst: vi.fn() },
  dayPatterns: { findFirst: vi.fn() },
}));

vi.mock("../db/index", () => ({
  db: { query: mockDbQuery },
}));

import {
  canEdit,
  checkTripAccess,
  isOwner,
  verifyDayAccess,
  verifyPatternAccess,
} from "../lib/permissions";

describe("checkTripAccess", () => {
  it("returns role when user is a member", async () => {
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId: "trip-1",
      userId: "user-1",
      role: "editor",
    });
    const result = await checkTripAccess("trip-1", "user-1");
    expect(result).toBe("editor");
  });

  it("returns null when user is not a member", async () => {
    mockDbQuery.tripMembers.findFirst.mockResolvedValue(undefined);
    const result = await checkTripAccess("trip-1", "user-1");
    expect(result).toBeNull();
  });
});

describe("canEdit", () => {
  it("returns true for owner", () => {
    expect(canEdit("owner")).toBe(true);
  });

  it("returns true for editor", () => {
    expect(canEdit("editor")).toBe(true);
  });

  it("returns false for viewer", () => {
    expect(canEdit("viewer")).toBe(false);
  });

  it("returns false for null", () => {
    expect(canEdit(null)).toBe(false);
  });
});

describe("isOwner", () => {
  it("returns true for owner", () => {
    expect(isOwner("owner")).toBe(true);
  });

  it("returns false for editor", () => {
    expect(isOwner("editor")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isOwner(null)).toBe(false);
  });
});

describe("verifyDayAccess", () => {
  beforeEach(() => {
    mockDbQuery.tripDays.findFirst.mockReset();
    mockDbQuery.tripMembers.findFirst.mockReset();
  });

  it("returns the role when both the day belongs to the trip and the user is a member", async () => {
    mockDbQuery.tripDays.findFirst.mockResolvedValue({ id: "day-1" });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({ role: "editor" });
    const result = await verifyDayAccess("trip-1", "day-1", "user-1");
    expect(result).toBe("editor");
  });

  it("returns null when the day does not belong to the trip", async () => {
    mockDbQuery.tripDays.findFirst.mockResolvedValue(undefined);
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({ role: "owner" });
    const result = await verifyDayAccess("trip-1", "day-other", "user-1");
    expect(result).toBeNull();
  });

  it("returns null when the user is not a trip member", async () => {
    mockDbQuery.tripDays.findFirst.mockResolvedValue({ id: "day-1" });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue(undefined);
    const result = await verifyDayAccess("trip-1", "day-1", "user-stranger");
    expect(result).toBeNull();
  });
});

describe("verifyPatternAccess", () => {
  beforeEach(() => {
    mockDbQuery.dayPatterns.findFirst.mockReset();
    mockDbQuery.tripMembers.findFirst.mockReset();
  });

  it("returns the role when pattern belongs to the given day and trip", async () => {
    mockDbQuery.dayPatterns.findFirst.mockResolvedValue({
      id: "pat-1",
      tripDayId: "day-1",
      tripDay: { id: "day-1", tripId: "trip-1" },
    });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({ role: "viewer" });
    const result = await verifyPatternAccess("trip-1", "day-1", "pat-1", "user-1");
    expect(result).toBe("viewer");
  });

  it("returns null when the pattern belongs to a different trip (cross-trip access attempt)", async () => {
    mockDbQuery.dayPatterns.findFirst.mockResolvedValue({
      id: "pat-1",
      tripDayId: "day-1",
      tripDay: { id: "day-1", tripId: "trip-OTHER" },
    });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({ role: "owner" });
    const result = await verifyPatternAccess("trip-1", "day-1", "pat-1", "user-1");
    expect(result).toBeNull();
  });

  it("returns null when the pattern does not exist", async () => {
    mockDbQuery.dayPatterns.findFirst.mockResolvedValue(undefined);
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({ role: "editor" });
    const result = await verifyPatternAccess("trip-1", "day-1", "pat-missing", "user-1");
    expect(result).toBeNull();
  });

  it("returns null when the user is not a trip member", async () => {
    mockDbQuery.dayPatterns.findFirst.mockResolvedValue({
      id: "pat-1",
      tripDayId: "day-1",
      tripDay: { id: "day-1", tripId: "trip-1" },
    });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue(undefined);
    const result = await verifyPatternAccess("trip-1", "day-1", "pat-1", "user-stranger");
    expect(result).toBeNull();
  });
});
