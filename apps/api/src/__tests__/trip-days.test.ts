import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockDbQuery, mockDbUpdate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    tripDays: {
      findFirst: vi.fn(),
    },
    tripMembers: {
      findFirst: vi.fn(),
    },
  },
  mockDbUpdate: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock("../lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { tripDayRoutes } from "../routes/trip-days";

const fakeUser = { id: "user-1", name: "Test User", email: "test@example.com" };
const tripId = "trip-1";
const dayId = "day-1";
const basePath = `/api/trips/${tripId}/days/${dayId}`;

function createApp() {
  const app = new Hono();
  app.route("/api/trips", tripDayRoutes);
  return app;
}

describe("Trip day routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId,
      userId: fakeUser.id,
      role: "owner",
    });
    mockDbQuery.tripDays.findFirst.mockResolvedValue({
      id: dayId,
      tripId,
      date: "2025-01-01",
      dayNumber: 1,
      memo: null,
    });
  });

  describe(`PATCH ${basePath}`, () => {
    it("updates memo successfully", async () => {
      const updated = {
        id: dayId,
        tripId,
        date: "2025-01-01",
        dayNumber: 1,
        memo: "Test memo",
      };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createApp();
      const res = await app.request(basePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: "Test memo" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.memo).toBe("Test memo");
    });

    it("clears memo with null", async () => {
      const updated = {
        id: dayId,
        tripId,
        date: "2025-01-01",
        dayNumber: 1,
        memo: null,
      };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createApp();
      const res = await app.request(basePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: null }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.memo).toBeNull();
    });

    it("returns 404 when viewer tries to update", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId,
        userId: fakeUser.id,
        role: "viewer",
      });

      const app = createApp();
      const res = await app.request(basePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: "Test memo" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent day", async () => {
      mockDbQuery.tripDays.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(basePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: "Test memo" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 for memo exceeding max length", async () => {
      const app = createApp();
      const res = await app.request(basePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: "a".repeat(501) }),
      });

      expect(res.status).toBe(400);
    });
  });
});
