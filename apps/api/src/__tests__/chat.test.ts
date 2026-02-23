import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbDelete, mockDbSelect, mockDbUpdate } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockDbQuery: {
      chatSessions: { findFirst: vi.fn() },
      chatMessages: { findFirst: vi.fn() },
      tripMembers: { findFirst: vi.fn() },
    },
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbSelect: vi.fn(),
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
    insert: (...args: unknown[]) => mockDbInsert(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock("../lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

import { chatRoutes } from "../routes/chat";
import { createTestApp, TEST_USER } from "./test-helpers";

const tripId = "trip-1";
const sessionId = "session-1";

function makeApp() {
  return createTestApp(chatRoutes, "/api/trips");
}

describe("Chat routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: TEST_USER,
      session: { id: "session-1" },
    });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId,
      userId: TEST_USER.id,
      role: "editor",
    });
    // Default: no existing chat session (not expired)
    mockDbQuery.chatSessions.findFirst.mockResolvedValue(null);
  });

  describe("GET /:tripId/chat/session", () => {
    it("returns null when no session exists", async () => {
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: mockInnerJoin,
        }),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/session`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.session).toBeNull();
    });

    it("returns null after cleaning up expired session", async () => {
      const expiredTime = new Date(Date.now() - 73 * 60 * 60 * 1000);
      // cleanupExpiredSession finds the expired session
      mockDbQuery.chatSessions.findFirst.mockResolvedValue({
        id: sessionId,
        tripId,
        lastMessageAt: expiredTime,
      });
      const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
      mockDbDelete.mockReturnValue({ where: mockDeleteWhere });
      // After cleanup, GET session query returns no rows
      const mockInnerJoin = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: mockInnerJoin,
        }),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/session`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.session).toBeNull();
      expect(mockDbDelete).toHaveBeenCalled();
    });

    it("returns 404 if not a trip member", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue(null);
      const res = await makeApp().request(`/api/trips/${tripId}/chat/session`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /:tripId/chat/session", () => {
    it("creates a session and returns 201", async () => {
      const now = new Date();
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: sessionId,
              tripId,
              startedBy: TEST_USER.id,
              createdAt: now,
              lastMessageAt: now,
            },
          ]),
        }),
      });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ name: TEST_USER.name, image: null }]),
          }),
        }),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/session`, {
        method: "POST",
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.session.id).toBe(sessionId);
    });

    it("returns 409 when session already exists", async () => {
      mockDbQuery.chatSessions.findFirst.mockResolvedValue({
        id: sessionId,
        tripId,
        lastMessageAt: new Date(),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/session`, {
        method: "POST",
      });
      expect(res.status).toBe(409);
    });

    it("returns 404 for viewer", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId,
        userId: TEST_USER.id,
        role: "viewer",
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/session`, {
        method: "POST",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:tripId/chat/session", () => {
    it("deletes session and returns 204", async () => {
      mockDbQuery.chatSessions.findFirst.mockResolvedValue({
        id: sessionId,
        tripId,
        lastMessageAt: new Date(),
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/session`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);
    });

    it("returns 404 when no session exists", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/chat/session`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /:tripId/chat/messages", () => {
    it("sends a message and returns 201", async () => {
      const now = new Date();
      mockDbQuery.chatSessions.findFirst.mockResolvedValue({
        id: sessionId,
        tripId,
        lastMessageAt: now,
      });
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([
              { id: "msg-1", sessionId, userId: TEST_USER.id, content: "hello", createdAt: now },
            ]),
        }),
      });
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ name: TEST_USER.name, image: null }]),
          }),
        }),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.content).toBe("hello");
    });

    it("returns 404 when no session exists", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for viewer", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId,
        userId: TEST_USER.id,
        role: "viewer",
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for whitespace-only content", async () => {
      mockDbQuery.chatSessions.findFirst.mockResolvedValue({
        id: sessionId,
        tripId,
        lastMessageAt: new Date(),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "   " }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for empty content", async () => {
      mockDbQuery.chatSessions.findFirst.mockResolvedValue({
        id: sessionId,
        tripId,
        lastMessageAt: new Date(),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /:tripId/chat/messages", () => {
    it("returns empty array when no session exists", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toEqual([]);
      expect(data.nextCursor).toBeNull();
    });

    it("returns messages in descending order", async () => {
      const now = new Date();
      mockDbQuery.chatSessions.findFirst.mockResolvedValue({
        id: sessionId,
        tripId,
        lastMessageAt: now,
      });
      const mockMessages = [
        {
          id: "msg-2",
          userId: TEST_USER.id,
          userName: TEST_USER.name,
          userImage: null,
          content: "second",
          createdAt: now,
        },
        {
          id: "msg-1",
          userId: TEST_USER.id,
          userName: TEST_USER.name,
          userImage: null,
          content: "first",
          createdAt: new Date(now.getTime() - 1000),
        },
      ];
      const mockLimit = vi.fn().mockResolvedValue(mockMessages);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: mockInnerJoin,
        }),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items).toHaveLength(2);
      expect(data.items[0].content).toBe("second");
    });
  });

  describe("PATCH /:tripId/chat/messages/:messageId", () => {
    const activeSession = { id: sessionId, tripId, lastMessageAt: new Date() };

    it("updates message content and returns 200", async () => {
      const now = new Date();
      const editedAt = new Date();
      mockDbQuery.chatSessions.findFirst.mockResolvedValue(activeSession);
      mockDbQuery.chatMessages.findFirst.mockResolvedValue({
        id: "msg-1",
        sessionId,
        userId: TEST_USER.id,
        content: "original",
        createdAt: now,
        editedAt: null,
      });
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "msg-1",
                sessionId,
                userId: TEST_USER.id,
                content: "updated",
                createdAt: now,
                editedAt,
              },
            ]),
          }),
        }),
      });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ name: TEST_USER.name, image: null }]),
          }),
        }),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "updated" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.content).toBe("updated");
      expect(data.editedAt).toBeDefined();
    });

    it("returns 404 if no active session", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "updated" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 if message not found", async () => {
      mockDbQuery.chatSessions.findFirst.mockResolvedValue(activeSession);
      mockDbQuery.chatMessages.findFirst.mockResolvedValue(null);

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "updated" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 403 if not message author", async () => {
      mockDbQuery.chatSessions.findFirst.mockResolvedValue(activeSession);
      mockDbQuery.chatMessages.findFirst.mockResolvedValue({
        id: "msg-1",
        sessionId,
        userId: "other-user-id",
        content: "original",
        createdAt: new Date(),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "updated" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns 400 for empty content", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /:tripId/chat/messages/:messageId", () => {
    const activeSession = { id: sessionId, tripId, lastMessageAt: new Date() };

    it("deletes message and returns 204", async () => {
      mockDbQuery.chatSessions.findFirst.mockResolvedValue(activeSession);
      mockDbQuery.chatMessages.findFirst.mockResolvedValue({
        id: "msg-1",
        sessionId,
        userId: TEST_USER.id,
        content: "to delete",
        createdAt: new Date(),
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(204);
    });

    it("returns 404 if no active session", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 if message not found", async () => {
      mockDbQuery.chatSessions.findFirst.mockResolvedValue(activeSession);
      mockDbQuery.chatMessages.findFirst.mockResolvedValue(null);

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });

    it("returns 403 if not message author", async () => {
      mockDbQuery.chatSessions.findFirst.mockResolvedValue(activeSession);
      mockDbQuery.chatMessages.findFirst.mockResolvedValue({
        id: "msg-1",
        sessionId,
        userId: "other-user-id",
        content: "someone else's",
        createdAt: new Date(),
      });

      const res = await makeApp().request(`/api/trips/${tripId}/chat/messages/msg-1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });
  });
});
