import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbDelete, mockDbUpdate, mockDbSelect } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockDbQuery: {
      friends: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
    },
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbUpdate: vi.fn(),
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
    delete: (...args: unknown[]) => mockDbDelete(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

import { MAX_FRIENDS_PER_USER } from "@sugara/shared";
import { friendRoutes } from "../routes/friends";

const userId = "00000000-0000-0000-0000-000000000001";
const otherUserId = "00000000-0000-0000-0000-000000000002";
const thirdUserId = "00000000-0000-0000-0000-000000000003";
const fakeUser = { id: userId, name: "Test User", email: "test@sugara.local" };
const friendRecordId = "00000000-0000-0000-0000-000000000099";

describe("Friend routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    // Default: count query returns 0 (under limit)
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });
  });

  // --- GET /api/friends ---
  describe("GET /api/friends", () => {
    it("returns accepted friends when user is requester", async () => {
      mockDbQuery.friends.findMany.mockResolvedValue([
        {
          id: friendRecordId,
          requesterId: userId,
          addresseeId: otherUserId,
          status: "accepted",
          addressee: { id: otherUserId, name: "Friend A" },
          requester: { id: userId, name: "Test User" },
        },
      ]);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].friendId).toBe(friendRecordId);
      expect(body[0].userId).toBe(otherUserId);
      expect(body[0].name).toBe("Friend A");
    });

    it("returns accepted friends when user is addressee", async () => {
      mockDbQuery.friends.findMany.mockResolvedValue([
        {
          id: friendRecordId,
          requesterId: otherUserId,
          addresseeId: userId,
          status: "accepted",
          addressee: { id: userId, name: "Test User" },
          requester: { id: otherUserId, name: "Friend B" },
        },
      ]);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].userId).toBe(otherUserId);
      expect(body[0].name).toBe("Friend B");
    });

    it("returns empty array when no friends", async () => {
      mockDbQuery.friends.findMany.mockResolvedValue([]);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual([]);
    });

    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends");

      expect(res.status).toBe(401);
    });
  });

  // --- GET /api/friends/requests ---
  describe("GET /api/friends/requests", () => {
    it("returns received pending requests", async () => {
      mockDbQuery.friends.findMany.mockResolvedValue([
        {
          id: friendRecordId,
          requesterId: otherUserId,
          addresseeId: userId,
          status: "pending",
          createdAt: "2025-07-01T00:00:00.000Z",
          requester: { id: otherUserId, name: "Requester" },
        },
      ]);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends/requests");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(friendRecordId);
      expect(body[0].requesterId).toBe(otherUserId);
      expect(body[0].name).toBe("Requester");
    });

    it("returns empty array when no requests", async () => {
      mockDbQuery.friends.findMany.mockResolvedValue([]);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends/requests");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual([]);
    });

    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends/requests");

      expect(res.status).toBe(401);
    });
  });

  // --- POST /api/friends/requests ---
  describe("POST /api/friends/requests", () => {
    it("returns 201 on successful request", async () => {
      mockDbQuery.users.findFirst.mockResolvedValue({
        id: otherUserId,
        name: "Target",
      });
      mockDbQuery.friends.findFirst.mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: friendRecordId }]),
        }),
      });

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresseeId: otherUserId }),
      });

      expect(res.status).toBe(201);
    });

    it("returns 400 when sending request to self", async () => {
      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresseeId: userId }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 with invalid UUID", async () => {
      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresseeId: "not-a-uuid" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when user not found", async () => {
      mockDbQuery.users.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresseeId: otherUserId }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 409 when already friends or pending", async () => {
      mockDbQuery.users.findFirst.mockResolvedValue({
        id: otherUserId,
        name: "Target",
      });
      mockDbQuery.friends.findFirst.mockResolvedValue({
        id: friendRecordId,
        requesterId: userId,
        addresseeId: otherUserId,
        status: "pending",
      });

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresseeId: otherUserId }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 409 when friend limit reached", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: MAX_FRIENDS_PER_USER }]),
        }),
      });

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresseeId: otherUserId }),
      });

      expect(res.status).toBe(409);
    });
  });

  // --- PATCH /api/friends/requests/:id ---
  describe("PATCH /api/friends/requests/:id", () => {
    it("returns 200 on accept success", async () => {
      mockDbQuery.friends.findFirst.mockResolvedValue({
        id: friendRecordId,
        requesterId: otherUserId,
        addresseeId: userId,
        status: "pending",
      });
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request(`/api/friends/requests/${friendRecordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("returns 404 when request not found", async () => {
      mockDbQuery.friends.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request(`/api/friends/requests/${friendRecordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when user is not addressee (security)", async () => {
      mockDbQuery.friends.findFirst.mockResolvedValue({
        id: friendRecordId,
        requesterId: otherUserId,
        addresseeId: thirdUserId,
        status: "pending",
      });

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request(`/api/friends/requests/${friendRecordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // --- DELETE /api/friends/requests/:id ---
  describe("DELETE /api/friends/requests/:id", () => {
    it("returns 200 when addressee rejects", async () => {
      mockDbQuery.friends.findFirst.mockResolvedValue({
        id: friendRecordId,
        requesterId: otherUserId,
        addresseeId: userId,
        status: "pending",
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request(`/api/friends/requests/${friendRecordId}`, {
        method: "DELETE",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("returns 200 when requester cancels", async () => {
      mockDbQuery.friends.findFirst.mockResolvedValue({
        id: friendRecordId,
        requesterId: userId,
        addresseeId: otherUserId,
        status: "pending",
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request(`/api/friends/requests/${friendRecordId}`, {
        method: "DELETE",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("returns 404 when not found", async () => {
      mockDbQuery.friends.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request(`/api/friends/requests/${friendRecordId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when unrelated user (security)", async () => {
      mockDbQuery.friends.findFirst.mockResolvedValue({
        id: friendRecordId,
        requesterId: otherUserId,
        addresseeId: thirdUserId,
        status: "pending",
      });

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request(`/api/friends/requests/${friendRecordId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  // --- DELETE /api/friends/:friendId ---
  describe("DELETE /api/friends/:friendId", () => {
    it("returns 200 when requester removes friend", async () => {
      mockDbQuery.friends.findFirst.mockResolvedValue({
        id: friendRecordId,
        requesterId: userId,
        addresseeId: otherUserId,
        status: "accepted",
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request(`/api/friends/${friendRecordId}`, {
        method: "DELETE",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("returns 200 when addressee removes friend", async () => {
      mockDbQuery.friends.findFirst.mockResolvedValue({
        id: friendRecordId,
        requesterId: otherUserId,
        addresseeId: userId,
        status: "accepted",
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request(`/api/friends/${friendRecordId}`, {
        method: "DELETE",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("returns 404 when not found", async () => {
      mockDbQuery.friends.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(friendRoutes, "/api/friends");
      const res = await app.request(`/api/friends/${friendRecordId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
