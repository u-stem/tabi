import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, TEST_USER } from "./test-helpers";

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
    trips: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    tripMembers: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    schedules: {
      findMany: vi.fn(),
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

import { tripRoutes } from "../routes/trips";

const fakeUser = TEST_USER;

describe("Trip routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    // Default: user is the owner of the trip
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId: "trip-1",
      userId: fakeUser.id,
      role: "owner",
    });
    mockDbQuery.schedules.findMany.mockResolvedValue([]);
    // Default: select queries (trip count, trip list, member count, candidate query)
    const mockWhere = vi.fn().mockImplementation(() => {
      const result = Promise.resolve([{ count: 0 }]);
      (result as unknown as Record<string, unknown>).groupBy = vi.fn().mockResolvedValue([]);
      return result;
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });
  });

  describe("POST /api/trips", () => {
    it("returns 201 with valid data", async () => {
      const createdTrip = {
        id: "trip-1",
        ownerId: fakeUser.id,
        title: "Tokyo Trip",
        destination: "Tokyo",
        startDate: "2025-07-01",
        endDate: "2025-07-03",
        status: "draft",
      };

      // db.transaction wraps insert calls
      mockDbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        let insertCallCount = 0;
        const tx = {
          insert: vi.fn().mockImplementation(() => {
            insertCallCount++;
            // First insert: trips (returning trip), second: tripDays (returning ids), third: dayPatterns, fourth: tripMembers
            if (insertCallCount === 1) {
              return {
                values: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([createdTrip]),
                }),
              };
            }
            if (insertCallCount === 2) {
              return {
                values: vi.fn().mockReturnValue({
                  returning: vi
                    .fn()
                    .mockResolvedValue([{ id: "day-1" }, { id: "day-2" }, { id: "day-3" }]),
                }),
              };
            }
            return {
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]),
              }),
            };
          }),
        };
        return fn(tx);
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Tokyo Trip",
          destination: "Tokyo",
          startDate: "2025-07-01",
          endDate: "2025-07-03",
        }),
      });

      expect(res.status).toBe(201);
    });

    it("returns 400 with empty title", async () => {
      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "",
          destination: "Tokyo",
          startDate: "2025-07-01",
          endDate: "2025-07-03",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when endDate is before startDate", async () => {
      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Tokyo Trip",
          destination: "Tokyo",
          startDate: "2025-07-05",
          endDate: "2025-07-01",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Tokyo Trip",
          destination: "Tokyo",
          startDate: "2025-07-01",
          endDate: "2025-07-03",
        }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 409 when trip limit reached", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Tokyo Trip",
          destination: "Tokyo",
          startDate: "2025-07-01",
          endDate: "2025-07-03",
        }),
      });

      expect(res.status).toBe(409);
      expect(mockDbTransaction).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/trips", () => {
    it("returns trips with totalSchedules", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([
                    {
                      id: "trip-1",
                      title: "Tokyo Trip",
                      role: "owner",
                      totalSchedules: 2,
                      updatedAt: new Date("2025-07-01"),
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].totalSchedules).toBe(2);
    });

    it("returns all trips by default (no scope filter)", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([
                    {
                      id: "trip-1",
                      title: "My Trip",
                      role: "owner",
                      updatedAt: new Date("2025-07-01"),
                    },
                    {
                      id: "trip-2",
                      title: "Shared Trip",
                      role: "editor",
                      updatedAt: new Date("2025-07-02"),
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(2);
    });

    it("returns only owned trips when scope=owned", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([
                    {
                      id: "trip-1",
                      title: "My Trip",
                      role: "owner",
                      updatedAt: new Date("2025-07-01"),
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips?scope=owned");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("trip-1");
    });

    it("returns only shared trips when scope=shared", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([
                    {
                      id: "trip-2",
                      title: "Shared Trip",
                      role: "editor",
                      updatedAt: new Date("2025-07-02"),
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips?scope=shared");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("trip-2");
    });

    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/trips/:id", () => {
    it("returns trip detail with role when found", async () => {
      const tripDetail = {
        id: "trip-1",
        title: "Tokyo Trip",
        ownerId: fakeUser.id,
        days: [],
      };
      mockDbQuery.trips.findFirst.mockResolvedValue(tripDetail);

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.id).toBe("trip-1");
      expect(body.role).toBe("owner");
    });

    it("returns editor role for editor member", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId: "trip-1",
        userId: fakeUser.id,
        role: "editor",
      });
      mockDbQuery.trips.findFirst.mockResolvedValue({
        id: "trip-1",
        title: "Tokyo Trip",
        days: [],
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.role).toBe("editor");
    });

    it("returns 404 when user is not a member", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/trips/:id", () => {
    it("returns updated trip on success", async () => {
      const updated = { id: "trip-1", title: "New Title", ownerId: fakeUser.id };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.title).toBe("New Title");
    });

    it("returns 404 when user is not a member", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when user is viewer (cannot edit)", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId: "trip-1",
        userId: fakeUser.id,
        role: "viewer",
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 with invalid data", async () => {
      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns updated trip when changing status", async () => {
      const updated = {
        id: "trip-1",
        title: "Tokyo Trip",
        ownerId: fakeUser.id,
        status: "planned",
      };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "planned" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("planned");
    });

    it("returns 400 with invalid status", async () => {
      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid" }),
      });

      expect(res.status).toBe(400);
    });

    it("uses transaction to adjust trip_days when changing dates", async () => {
      const existingTrip = {
        id: "trip-1",
        startDate: "2025-07-01",
        endDate: "2025-07-03",
      };
      mockDbQuery.trips.findFirst.mockResolvedValue(existingTrip);

      const updated = {
        id: "trip-1",
        title: "Tokyo Trip",
        startDate: "2025-07-02",
        endDate: "2025-07-05",
      };
      mockDbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "new-day-1" }]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([updated]),
              }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  { id: "day-2", date: "2025-07-02", dayNumber: 1 },
                  { id: "day-3", date: "2025-07-03", dayNumber: 2 },
                ]),
              }),
            }),
          }),
        };
        return fn(tx);
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: "2025-07-02", endDate: "2025-07-05" }),
      });

      expect(res.status).toBe(200);
      expect(mockDbTransaction).toHaveBeenCalledOnce();
    });

    it("returns 400 when startDate is after endDate", async () => {
      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: "2025-07-10", endDate: "2025-07-01" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 200 when only startDate is sent", async () => {
      const existingTrip = {
        id: "trip-1",
        startDate: "2025-07-01",
        endDate: "2025-07-03",
      };
      mockDbQuery.trips.findFirst.mockResolvedValue(existingTrip);

      const updated = {
        id: "trip-1",
        startDate: "2025-07-02",
        endDate: "2025-07-03",
      };
      mockDbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "new-day-1" }]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([updated]),
              }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  { id: "day-2", date: "2025-07-02", dayNumber: 1 },
                  { id: "day-3", date: "2025-07-03", dayNumber: 2 },
                ]),
              }),
            }),
          }),
        };
        return fn(tx);
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: "2025-07-02" }),
      });

      expect(res.status).toBe(200);
      expect(mockDbTransaction).toHaveBeenCalledOnce();
    });
  });

  describe("POST /api/trips/:id/duplicate", () => {
    it("returns 409 when trip limit reached", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1/duplicate", {
        method: "POST",
      });

      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /api/trips/:id", () => {
    it("returns ok on success", async () => {
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1", {
        method: "DELETE",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
    });

    it("returns 404 when user is not a member", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when user is editor (not owner)", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId: "trip-1",
        userId: fakeUser.id,
        role: "editor",
      });

      const app = createTestApp(tripRoutes, "/api/trips");
      const res = await app.request("/api/trips/trip-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
