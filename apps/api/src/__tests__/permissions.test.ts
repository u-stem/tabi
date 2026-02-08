import { describe, expect, it, vi } from "vitest";

const mockDbQuery = vi.hoisted(() => ({
  tripMembers: { findFirst: vi.fn() },
}));

vi.mock("../db/index", () => ({
  db: { query: mockDbQuery },
}));

import { canEdit, checkTripAccess, isOwner } from "../lib/permissions";

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
