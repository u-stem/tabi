import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetSession,
  mockDbQuery,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockDbTransaction,
  mockDbSelect,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    tripDays: {
      findFirst: vi.fn(),
    },
    dayPatterns: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    tripMembers: {
      findFirst: vi.fn(),
    },
  },
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbTransaction: vi.fn(),
  mockDbSelect: vi.fn(),
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
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    transaction: (...args: unknown[]) => mockDbTransaction(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock("../lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { patternRoutes } from "../routes/patterns";

const fakeUser = { id: "user-1", name: "Test User", email: "test@example.com" };
const tripId = "trip-1";
const dayId = "day-1";
const patternId = "pattern-1";
const basePath = `/api/trips/${tripId}/days/${dayId}/patterns`;

function createApp() {
  const app = new Hono();
  app.route("/api/trips", patternRoutes);
  return app;
}

describe("Pattern routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    mockDbQuery.tripDays.findFirst.mockResolvedValue({
      id: dayId,
      tripId,
    });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId,
      userId: fakeUser.id,
      role: "owner",
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ max: 0 }]),
      }),
    });
  });

  describe(`GET ${basePath}`, () => {
    it("returns patterns for a day", async () => {
      const patterns = [
        { id: "p-1", label: "デフォルト", isDefault: true, sortOrder: 0, schedules: [] },
      ];
      mockDbQuery.dayPatterns.findMany.mockResolvedValue(patterns);

      const app = createApp();
      const res = await app.request(basePath);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual(patterns);
    });

    it("returns 404 when day does not belong to trip", async () => {
      mockDbQuery.tripDays.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(basePath);

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-member", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue(null);

      const app = createApp();
      const res = await app.request(basePath);

      expect(res.status).toBe(404);
    });
  });

  describe(`POST ${basePath}`, () => {
    it("creates a pattern with valid label", async () => {
      const created = {
        id: "p-2",
        tripDayId: dayId,
        label: "Rainy",
        isDefault: false,
        sortOrder: 1,
      };
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([created]),
        }),
      });

      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Rainy" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.label).toBe("Rainy");
    });

    it("returns 400 for empty label", async () => {
      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when viewer tries to create", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId,
        userId: fakeUser.id,
        role: "viewer",
      });

      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Rainy" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe(`PATCH ${basePath}/${patternId}`, () => {
    it("updates pattern label", async () => {
      mockDbQuery.dayPatterns.findFirst.mockResolvedValue({
        id: patternId,
        tripDayId: dayId,
        label: "Old",
        isDefault: false,
      });
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: patternId, label: "New", isDefault: false }]),
          }),
        }),
      });

      const app = createApp();
      const res = await app.request(`${basePath}/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "New" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.label).toBe("New");
    });

    it("returns 404 for non-existent pattern", async () => {
      mockDbQuery.dayPatterns.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(`${basePath}/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "New" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid data", async () => {
      const app = createApp();
      const res = await app.request(`${basePath}/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe(`DELETE ${basePath}/${patternId}`, () => {
    it("deletes a non-default pattern", async () => {
      mockDbQuery.dayPatterns.findFirst.mockResolvedValue({
        id: patternId,
        tripDayId: dayId,
        isDefault: false,
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createApp();
      const res = await app.request(`${basePath}/${patternId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
    });

    it("returns 400 when deleting default pattern", async () => {
      mockDbQuery.dayPatterns.findFirst.mockResolvedValue({
        id: patternId,
        tripDayId: dayId,
        isDefault: true,
      });

      const app = createApp();
      const res = await app.request(`${basePath}/${patternId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent pattern", async () => {
      mockDbQuery.dayPatterns.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(`${basePath}/${patternId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  describe(`POST ${basePath}/${patternId}/duplicate`, () => {
    it("duplicates a pattern with schedules", async () => {
      const sourceSchedules = [
        {
          name: "Tokyo Tower",
          category: "sightseeing",
          address: null,
          startTime: "09:00",
          endTime: "10:00",
          sortOrder: 0,
          memo: null,
          url: null,
          departurePlace: null,
          arrivalPlace: null,
          transportMethod: null,
          color: null,
        },
      ];
      mockDbQuery.dayPatterns.findFirst.mockResolvedValue({
        id: patternId,
        tripDayId: dayId,
        label: "Sunny",
        schedules: sourceSchedules,
      });

      const duplicated = {
        id: "p-new",
        tripDayId: dayId,
        label: "Sunny (copy)",
        isDefault: false,
        sortOrder: 1,
      };
      mockDbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([duplicated]),
            }),
          }),
        };
        return fn(tx);
      });

      const app = createApp();
      const res = await app.request(`${basePath}/${patternId}/duplicate`, {
        method: "POST",
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.label).toBe("Sunny (copy)");
    });

    it("returns 404 for non-existent pattern", async () => {
      mockDbQuery.dayPatterns.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(`${basePath}/${patternId}/duplicate`, {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });
  });
});
