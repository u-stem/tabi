import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockDbQuery, mockDbUpdate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    trips: {
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

import { shareRoutes } from "../routes/share";

const fakeUser = { id: "user-1", name: "Test User", email: "test@example.com" };

function createApp() {
  const app = new Hono();
  app.route("/", shareRoutes);
  return app;
}

describe("Share routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    // Default: user is the owner
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId: "trip-1",
      userId: fakeUser.id,
      role: "owner",
    });
  });

  describe("POST /api/trips/:id/share", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const app = createApp();
      const res = await app.request("/api/trips/trip-1/share", {
        method: "POST",
      });

      expect(res.status).toBe(401);
    });

    it("returns 404 when user is not owner", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request("/api/trips/trip-1/share", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when user is editor (not owner)", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId: "trip-1",
        userId: fakeUser.id,
        role: "editor",
      });

      const app = createApp();
      const res = await app.request("/api/trips/trip-1/share", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });

    it("returns existing shareToken if already set", async () => {
      const existingToken = "abc123existingtoken";
      mockDbQuery.trips.findFirst.mockResolvedValue({
        shareToken: existingToken,
      });

      const app = createApp();
      const res = await app.request("/api/trips/trip-1/share", {
        method: "POST",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.shareToken).toBe(existingToken);
    });

    it("generates a new shareToken when not set", async () => {
      const generatedToken = "abc123generated";
      mockDbQuery.trips.findFirst.mockResolvedValue({
        shareToken: null,
      });

      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ shareToken: generatedToken }]),
          }),
        }),
      });

      const app = createApp();
      const res = await app.request("/api/trips/trip-1/share", {
        method: "POST",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.shareToken).toBeDefined();
      expect(typeof body.shareToken).toBe("string");
      expect(body.shareToken.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/shared/:token", () => {
    it("returns 404 with invalid token", async () => {
      mockDbQuery.trips.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request("/api/shared/invalid-token");

      expect(res.status).toBe(404);
    });

    it("returns trip without sensitive fields", async () => {
      const sharedTrip = {
        id: "trip-1",
        ownerId: "user-1",
        shareToken: "valid-token",
        title: "Tokyo Trip",
        destination: "Tokyo",
        startDate: "2025-07-01",
        endDate: "2025-07-03",
        days: [],
      };
      mockDbQuery.trips.findFirst.mockResolvedValue(sharedTrip);

      const app = createApp();
      const res = await app.request("/api/shared/valid-token");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.title).toBe("Tokyo Trip");
      expect(body.ownerId).toBeUndefined();
      expect(body.shareToken).toBeUndefined();
    });

    it("does not require authentication", async () => {
      mockGetSession.mockResolvedValue(null);
      mockDbQuery.trips.findFirst.mockResolvedValue({
        id: "trip-1",
        ownerId: "user-1",
        shareToken: "valid-token",
        title: "Tokyo Trip",
        destination: "Tokyo",
        days: [],
      });

      const app = createApp();
      const res = await app.request("/api/shared/valid-token");

      expect(res.status).toBe(200);
    });
  });
});
