import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete, mockDbSelect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    spots: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
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
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

import { spotRoutes } from "../routes/spots";

const fakeUser = { id: "user-1", name: "Test User", email: "test@example.com" };
const tripId = "trip-1";
const dayId = "day-1";
const basePath = `/api/trips/${tripId}/days/${dayId}/spots`;

function createApp() {
  const app = new Hono();
  app.route("/api/trips", spotRoutes);
  return app;
}

describe("Spot routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
  });

  describe(`POST ${basePath}`, () => {
    it("returns 201 with valid data", async () => {
      const createdSpot = {
        id: "spot-1",
        tripDayId: dayId,
        name: "Tokyo Tower",
        category: "sightseeing",
        sortOrder: 0,
      };

      // db.select({ max: ... }).from(spots).where(...)
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: -1 }]),
        }),
      });

      // db.insert(spots).values(...).returning()
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdSpot]),
        }),
      });

      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tokyo Tower",
          category: "sightseeing",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("Tokyo Tower");
    });

    it("returns 400 with empty name", async () => {
      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "",
          category: "sightseeing",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 with invalid category", async () => {
      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tokyo Tower",
          category: "invalid_category",
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe(`PATCH ${basePath}/:spotId`, () => {
    it("returns 400 with invalid data", async () => {
      const app = createApp();
      const res = await app.request(`${basePath}/spot-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "invalid_category" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe(`DELETE ${basePath}/:spotId`, () => {
    it("returns 404 when spot not found", async () => {
      mockDbQuery.spots.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(`${basePath}/nonexistent`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  describe(`PATCH ${basePath}/reorder`, () => {
    it("returns 400 with invalid data", async () => {
      const app = createApp();
      const res = await app.request(`${basePath}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotIds: ["not-a-uuid"] }),
      });

      expect(res.status).toBe(400);
    });
  });
});
