import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete, mockDbTransaction } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    trips: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbTransaction: vi.fn(),
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
  },
}));

import { tripRoutes } from "../routes/trips";

const fakeUser = { id: "user-1", name: "Test User", email: "test@example.com" };

function createApp() {
  const app = new Hono();
  app.route("/api/trips", tripRoutes);
  return app;
}

describe("Trip routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
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
      mockDbTransaction.mockImplementation(async (fn: Function) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([createdTrip]),
            }),
          }),
        };
        return fn(tx);
      });

      const app = createApp();
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
      const app = createApp();
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
      const app = createApp();
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

      const app = createApp();
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
  });

  describe("GET /api/trips", () => {
    it("returns an array of trips", async () => {
      mockDbQuery.trips.findMany.mockResolvedValue([
        { id: "trip-1", title: "Tokyo Trip" },
      ]);

      const app = createApp();
      const res = await app.request("/api/trips");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });

    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const app = createApp();
      const res = await app.request("/api/trips");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/trips/:id", () => {
    it("returns trip detail when found", async () => {
      const tripDetail = {
        id: "trip-1",
        title: "Tokyo Trip",
        ownerId: fakeUser.id,
        days: [],
      };
      mockDbQuery.trips.findFirst.mockResolvedValue(tripDetail);

      const app = createApp();
      const res = await app.request("/api/trips/trip-1");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.id).toBe("trip-1");
    });

    it("returns 404 when trip not found", async () => {
      mockDbQuery.trips.findFirst.mockResolvedValue(undefined);

      const app = createApp();
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

      const app = createApp();
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.title).toBe("New Title");
    });

    it("returns 404 when trip not found", async () => {
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const app = createApp();
      const res = await app.request("/api/trips/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 with invalid data", async () => {
      const app = createApp();
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when trying to change dates", async () => {
      const app = createApp();
      const res = await app.request("/api/trips/trip-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: "2025-08-01" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/trips/:id", () => {
    it("returns ok on success", async () => {
      const existing = { id: "trip-1", ownerId: fakeUser.id };
      mockDbQuery.trips.findFirst.mockResolvedValue(existing);
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createApp();
      const res = await app.request("/api/trips/trip-1", {
        method: "DELETE",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
    });

    it("returns 404 when trip not found", async () => {
      mockDbQuery.trips.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request("/api/trips/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
