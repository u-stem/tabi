import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(
  () => ({
    mockGetSession: vi.fn(),
    mockDbQuery: {
      tripMembers: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
    },
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
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
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

import { memberRoutes } from "../routes/members";

const fakeUser = { id: "user-1", name: "Test User", email: "test@example.com" };
const tripId = "trip-1";
const basePath = `/api/trips/${tripId}/members`;

function createApp() {
  const app = new Hono();
  app.route("/api/trips", memberRoutes);
  return app;
}

describe("Member routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    // Default: user is owner
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId,
      userId: fakeUser.id,
      role: "owner",
    });
  });

  describe(`GET ${basePath}`, () => {
    it("returns list of members", async () => {
      const members = [
        { userId: fakeUser.id, role: "owner", user: { id: fakeUser.id, name: "Owner", email: "owner@test.com" } },
        { userId: "user-2", role: "editor", user: { id: "user-2", name: "Editor", email: "editor@test.com" } },
      ];
      mockDbQuery.tripMembers.findMany.mockResolvedValue(members);

      const app = createApp();
      const res = await app.request(basePath);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(2);
      expect(body[0].role).toBe("owner");
      expect(body[1].email).toBe("editor@test.com");
    });

    it("returns 404 when user is not a member", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(basePath);

      expect(res.status).toBe(404);
    });

    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const app = createApp();
      const res = await app.request(basePath);

      expect(res.status).toBe(401);
    });
  });

  describe(`POST ${basePath}`, () => {
    it("returns 201 when adding a member", async () => {
      mockDbQuery.users.findFirst.mockResolvedValue({
        id: "user-2",
        name: "New Member",
        email: "new@test.com",
      });
      // No existing membership (second call after owner check)
      mockDbQuery.tripMembers.findFirst
        .mockResolvedValueOnce({ tripId, userId: fakeUser.id, role: "owner" })
        .mockResolvedValueOnce(undefined);
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@test.com", role: "editor" }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.ok).toBe(true);
    });

    it("returns 403 when user is editor (not owner)", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId,
        userId: fakeUser.id,
        role: "editor",
      });

      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@test.com", role: "editor" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 404 when target user not found", async () => {
      mockDbQuery.users.findFirst.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nonexistent@test.com", role: "editor" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 409 when user is already a member", async () => {
      mockDbQuery.users.findFirst.mockResolvedValue({
        id: "user-2",
        email: "existing@test.com",
      });
      // First call: owner check; second call: existing member found
      mockDbQuery.tripMembers.findFirst
        .mockResolvedValueOnce({ tripId, userId: fakeUser.id, role: "owner" })
        .mockResolvedValueOnce({ tripId, userId: "user-2", role: "editor" });

      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "existing@test.com", role: "editor" }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 400 with invalid email", async () => {
      const app = createApp();
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", role: "editor" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe(`PATCH ${basePath}/:userId`, () => {
    it("returns ok when updating role", async () => {
      // First call: owner check; second call: target member exists
      mockDbQuery.tripMembers.findFirst
        .mockResolvedValueOnce({ tripId, userId: fakeUser.id, role: "owner" })
        .mockResolvedValueOnce({ tripId, userId: "user-2", role: "editor" });
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const app = createApp();
      const res = await app.request(`${basePath}/user-2`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "viewer" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("returns 400 when trying to change own role", async () => {
      const app = createApp();
      const res = await app.request(`${basePath}/${fakeUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "viewer" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 403 when user is not owner", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId,
        userId: fakeUser.id,
        role: "editor",
      });

      const app = createApp();
      const res = await app.request(`${basePath}/user-2`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "viewer" }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe(`DELETE ${basePath}/:userId`, () => {
    it("returns ok when removing a member", async () => {
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createApp();
      const res = await app.request(`${basePath}/user-2`, {
        method: "DELETE",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("returns 400 when trying to remove self", async () => {
      const app = createApp();
      const res = await app.request(`${basePath}/${fakeUser.id}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
    });

    it("returns 403 when user is not owner", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId,
        userId: fakeUser.id,
        role: "viewer",
      });

      const app = createApp();
      const res = await app.request(`${basePath}/user-2`, {
        method: "DELETE",
      });

      expect(res.status).toBe(403);
    });
  });
});
