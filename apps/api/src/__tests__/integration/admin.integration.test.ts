import { Hono } from "hono";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("../../db/index", async () => {
  const { getTestDb } = await import("./setup");
  return { db: getTestDb() };
});

vi.mock("../../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

import { adminRoutes } from "../../routes/admin";
import { cleanupTables, teardownTestDb } from "./setup";

function createApp() {
  const app = new Hono();
  app.route("/", adminRoutes);
  return app;
}

describe("Admin Integration", () => {
  const app = createApp();

  beforeEach(async () => {
    await cleanupTables();
    process.env.ADMIN_USERNAME = "adminuser";
  });

  afterEach(() => {
    delete process.env.ADMIN_USERNAME;
  });

  afterAll(async () => {
    await cleanupTables();
    await teardownTestDb();
  });

  describe("GET /api/admin/stats", () => {
    it("returns 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const res = await app.request("/api/admin/stats");

      expect(res.status).toBe(401);
    });

    it("returns 403 when username does not match ADMIN_USERNAME", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-1",
          name: "Other",
          email: "other@test.com",
          username: "notadmin",
          isAnonymous: false,
        },
        session: { id: "session-1" },
      });

      const res = await app.request("/api/admin/stats");

      expect(res.status).toBe(403);
    });

    it("returns 403 when ADMIN_USERNAME env var is not set", async () => {
      delete process.env.ADMIN_USERNAME;
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-1",
          name: "Admin",
          email: "admin@test.com",
          username: "adminuser",
          isAnonymous: false,
        },
        session: { id: "session-1" },
      });

      const res = await app.request("/api/admin/stats");

      expect(res.status).toBe(403);
    });

    it("returns 200 with correct stats shape when authenticated as admin", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-1",
          name: "Admin",
          email: "admin@test.com",
          username: "adminuser",
          isAnonymous: false,
        },
        session: { id: "session-1" },
      });

      const res = await app.request("/api/admin/stats");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        users: {
          total: expect.any(Number),
          guest: expect.any(Number),
          newLast7Days: expect.any(Number),
          newLast30Days: expect.any(Number),
        },
        trips: {
          total: expect.any(Number),
          byStatus: {
            scheduling: expect.any(Number),
            draft: expect.any(Number),
            planned: expect.any(Number),
            active: expect.any(Number),
            completed: expect.any(Number),
          },
          newLast7Days: expect.any(Number),
        },
        content: {
          schedules: expect.any(Number),
          souvenirs: expect.any(Number),
        },
        supabase: {
          mau: expect.any(Number),
          dbSizeBytes: expect.any(Number),
        },
      });
    });

    it("returns zero counts on empty database", async () => {
      mockGetSession.mockResolvedValue({
        user: {
          id: "user-1",
          name: "Admin",
          email: "admin@test.com",
          username: "adminuser",
          isAnonymous: false,
        },
        session: { id: "session-1" },
      });

      const res = await app.request("/api/admin/stats");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.users.total).toBe(0);
      expect(data.trips.total).toBe(0);
      expect(data.content.schedules).toBe(0);
      expect(data.supabase.mau).toBe(0);
      expect(data.supabase.dbSizeBytes).toBeGreaterThan(0);
    });
  });
});
