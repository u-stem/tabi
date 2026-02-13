import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbDelete, mockDbSelect } = vi.hoisted(
  () => ({
    mockGetSession: vi.fn(),
    mockDbQuery: {
      schedules: { findFirst: vi.fn() },
      tripMembers: { findFirst: vi.fn() },
    },
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbSelect: vi.fn(),
  }),
);

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
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock("../lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { reactionRoutes } from "../routes/reactions";
import { createTestApp, TEST_USER } from "./test-helpers";

const fakeUser = TEST_USER;
const tripId = "trip-1";
const scheduleId = "schedule-1";

describe("Reaction routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId,
      userId: fakeUser.id,
      role: "viewer",
    });
  });

  describe("PUT /:tripId/candidates/:scheduleId/reaction", () => {
    it("returns 404 if not a trip member", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue(null);
      const app = createTestApp(reactionRoutes, "/api/trips");
      const res = await app.request(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "like" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid reaction type", async () => {
      const app = createTestApp(reactionRoutes, "/api/trips");
      const res = await app.request(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "invalid" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 if schedule is not a candidate", async () => {
      mockDbQuery.schedules.findFirst.mockResolvedValue(null);
      const app = createTestApp(reactionRoutes, "/api/trips");
      const res = await app.request(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "like" }),
      });
      expect(res.status).toBe(404);
    });

    it("upserts reaction and returns counts", async () => {
      mockDbQuery.schedules.findFirst.mockResolvedValue({
        id: scheduleId,
        dayPatternId: null,
        tripId,
      });
      const mockOnConflict = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ scheduleId, userId: fakeUser.id, type: "like" }]),
      });
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict }),
      });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ likeCount: 1, hmmCount: 0 }]),
        }),
      });

      const app = createTestApp(reactionRoutes, "/api/trips");
      const res = await app.request(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "like" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.type).toBe("like");
      expect(data.likeCount).toBe(1);
    });

    it("allows viewer to react", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId,
        userId: fakeUser.id,
        role: "viewer",
      });
      mockDbQuery.schedules.findFirst.mockResolvedValue({
        id: scheduleId,
        dayPatternId: null,
        tripId,
      });
      const mockOnConflict = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ scheduleId, userId: fakeUser.id, type: "hmm" }]),
      });
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflict }),
      });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ likeCount: 0, hmmCount: 1 }]),
        }),
      });

      const app = createTestApp(reactionRoutes, "/api/trips");
      const res = await app.request(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hmm" }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /:tripId/candidates/:scheduleId/reaction", () => {
    it("returns 404 if not a trip member", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue(null);
      const app = createTestApp(reactionRoutes, "/api/trips");
      const res = await app.request(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 if schedule is not a candidate", async () => {
      mockDbQuery.schedules.findFirst.mockResolvedValue(null);
      const app = createTestApp(reactionRoutes, "/api/trips");
      const res = await app.request(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });

    it("deletes reaction and returns counts", async () => {
      mockDbQuery.schedules.findFirst.mockResolvedValue({
        id: scheduleId,
        dayPatternId: null,
        tripId,
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ likeCount: 0, hmmCount: 0 }]),
        }),
      });

      const app = createTestApp(reactionRoutes, "/api/trips");
      const res = await app.request(`/api/trips/${tripId}/candidates/${scheduleId}/reaction`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.likeCount).toBe(0);
      expect(data.hmmCount).toBe(0);
    });
  });
});
