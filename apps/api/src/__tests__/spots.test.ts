import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetSession,
  mockDbQuery,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockDbSelect,
  mockDbTransaction,
  mockGeocode,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    spots: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    trips: {
      findFirst: vi.fn(),
    },
    tripDays: {
      findFirst: vi.fn(),
    },
    tripMembers: {
      findFirst: vi.fn(),
    },
  },
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbTransaction: vi.fn(),
  mockGeocode: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../lib/geocoding", () => ({
  geocode: (...args: unknown[]) => mockGeocode(...args),
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
    transaction: (...args: unknown[]) => mockDbTransaction(...args),
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
    // Default: day belongs to trip, user is an editor/owner
    mockDbQuery.tripDays.findFirst.mockResolvedValue({
      id: dayId,
      tripId,
    });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId,
      userId: fakeUser.id,
      role: "owner",
    });
  });

  describe(`GET ${basePath}`, () => {
    it("returns spots for a day", async () => {
      const daySpots = [
        { id: "spot-1", name: "Tokyo Tower", category: "sightseeing", sortOrder: 0 },
      ];
      mockDbQuery.spots.findMany.mockResolvedValue(daySpots);

      const app = createApp();
      const res = await app.request(basePath);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual(daySpots);
    });

    it("returns 404 when day does not belong to user", async () => {
      mockDbQuery.tripDays.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(basePath);

      expect(res.status).toBe(404);
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

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: -1 }]),
        }),
      });

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

    it("returns 404 when day does not belong to user", async () => {
      mockDbQuery.tripDays.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tokyo Tower",
          category: "sightseeing",
        }),
      });

      expect(res.status).toBe(404);
    });

    it("geocodes address when coordinates are not provided", async () => {
      mockGeocode.mockResolvedValue({ latitude: 35.0394, longitude: 135.7291 });

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: -1 }]),
        }),
      });

      const createdSpot = {
        id: "spot-1",
        tripDayId: dayId,
        name: "Kinkaku-ji",
        category: "sightseeing",
        address: "京都市北区金閣寺町1",
        latitude: "35.0394",
        longitude: "135.7291",
        sortOrder: 0,
      };
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
          name: "Kinkaku-ji",
          category: "sightseeing",
          address: "京都市北区金閣寺町1",
        }),
      });

      expect(res.status).toBe(201);
      expect(mockGeocode).toHaveBeenCalledWith("京都市北区金閣寺町1");
    });

    it("saves spot without coordinates when geocoding fails", async () => {
      mockGeocode.mockResolvedValue(null);

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: -1 }]),
        }),
      });

      const createdSpot = {
        id: "spot-1",
        tripDayId: dayId,
        name: "Unknown Place",
        category: "sightseeing",
        address: "unknown address",
        sortOrder: 0,
      };
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
          name: "Unknown Place",
          category: "sightseeing",
          address: "unknown address",
        }),
      });

      expect(res.status).toBe(201);
      expect(mockGeocode).toHaveBeenCalledWith("unknown address");
    });

    it("skips geocoding when explicit coordinates are provided", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ max: -1 }]),
        }),
      });

      const createdSpot = {
        id: "spot-1",
        tripDayId: dayId,
        name: "Custom Place",
        category: "sightseeing",
        latitude: "35.0",
        longitude: "135.0",
        sortOrder: 0,
      };
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
          name: "Custom Place",
          category: "sightseeing",
          address: "some address",
          latitude: 35.0,
          longitude: 135.0,
        }),
      });

      expect(res.status).toBe(201);
      expect(mockGeocode).not.toHaveBeenCalled();
    });
  });

  describe(`PATCH ${basePath}/:spotId`, () => {
    it("returns updated spot on success", async () => {
      const existing = { id: "spot-1", name: "Old Name", category: "sightseeing" };
      const updated = { ...existing, name: "New Name" };
      mockDbQuery.spots.findFirst.mockResolvedValue(existing);
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createApp();
      const res = await app.request(`${basePath}/spot-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("New Name");
    });

    it("returns 400 with invalid data", async () => {
      const app = createApp();
      const res = await app.request(`${basePath}/spot-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "invalid_category" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when spot not found", async () => {
      mockDbQuery.spots.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(`${basePath}/spot-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe(`DELETE ${basePath}/:spotId`, () => {
    it("returns ok on success", async () => {
      mockDbQuery.spots.findFirst.mockResolvedValue({ id: "spot-1" });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createApp();
      const res = await app.request(`${basePath}/spot-1`, {
        method: "DELETE",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
    });

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
    it("returns ok with valid UUIDs", async () => {
      const spotId = "550e8400-e29b-41d4-a716-446655440000";
      mockDbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          query: {
            spots: {
              findMany: vi.fn().mockResolvedValue([{ id: spotId, tripDayId: dayId }]),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        await fn(tx);
      });

      const app = createApp();
      const res = await app.request(`${basePath}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotIds: [spotId],
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
    });

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
