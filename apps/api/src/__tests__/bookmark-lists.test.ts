import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const {
  mockGetSession,
  mockDbQuery,
  mockDbInsert,
  mockDbDelete,
  mockDbUpdate,
  mockDbSelect,
  mockDbTransaction,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    bookmarkLists: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  mockDbInsert: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbSelect: vi.fn(),
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
    delete: (...args: unknown[]) => mockDbDelete(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
    transaction: (...args: unknown[]) => mockDbTransaction(...args),
  },
}));

import { MAX_BOOKMARK_LISTS_PER_USER } from "@sugara/shared";
import { bookmarkListRoutes } from "../routes/bookmark-lists";

const userId = "00000000-0000-0000-0000-000000000001";
const otherUserId = "00000000-0000-0000-0000-000000000002";
const fakeUser = { id: userId, name: "Test User", email: "test@sugara.local" };
const listId = "00000000-0000-0000-0000-000000000010";

describe("Bookmark list routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });
  });

  // --- GET /api/bookmark-lists ---
  describe("GET /api/bookmark-lists", () => {
    it("returns own lists with bookmark count", async () => {
      mockDbQuery.bookmarkLists.findMany.mockResolvedValue([
        {
          id: listId,
          name: "Tokyo Cafes",
          visibility: "private",
          sortOrder: 0,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
          bookmarks: [{ id: "b1" }],
        },
      ]);

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Tokyo Cafes");
      expect(body[0].bookmarkCount).toBe(1);
    });

    it("returns empty array when no lists", async () => {
      mockDbQuery.bookmarkLists.findMany.mockResolvedValue([]);

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual([]);
    });

    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists");

      expect(res.status).toBe(401);
    });
  });

  // --- POST /api/bookmark-lists ---
  describe("POST /api/bookmark-lists", () => {
    it("creates list with 201", async () => {
      const created = {
        id: listId,
        name: "Tokyo Cafes",
        visibility: "private",
        sortOrder: 0,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([created]),
        }),
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tokyo Cafes" }),
      });

      expect(res.status).toBe(201);
    });

    it("returns 400 with empty name", async () => {
      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 when list limit reached", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: MAX_BOOKMARK_LISTS_PER_USER }]),
        }),
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New List" }),
      });

      expect(res.status).toBe(409);
    });
  });

  // --- PATCH /api/bookmark-lists/:listId ---
  describe("PATCH /api/bookmark-lists/:listId", () => {
    it("updates list name", async () => {
      const existing = { id: listId, userId, name: "Old", visibility: "private" };
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, name: "New" };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 404 when list not found", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when not owner", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({
        id: listId,
        userId: otherUserId,
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hack" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // --- POST /api/bookmark-lists/:listId/duplicate ---
  describe("POST /api/bookmark-lists/:listId/duplicate", () => {
    it("duplicates list with bookmarks and returns 201", async () => {
      const source = {
        id: listId,
        userId,
        name: "Tokyo Cafes",
        visibility: "private",
        bookmarks: [
          { id: "b1", name: "Cafe A", memo: "Good coffee", url: "https://a.com", sortOrder: 0 },
          { id: "b2", name: "Cafe B", memo: null, url: null, sortOrder: 1 },
        ],
      };
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue(source);

      const newList = {
        id: "new-list-id",
        userId,
        name: "Tokyo Cafes (copy)",
        visibility: "private",
        sortOrder: 0,
      };
      mockDbTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([newList]),
            }),
          }),
        };
        return fn(tx);
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/duplicate`, {
        method: "POST",
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe("Tokyo Cafes (copy)");
    });

    it("returns 409 when list limit reached", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: MAX_BOOKMARK_LISTS_PER_USER }]),
        }),
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/duplicate`, {
        method: "POST",
      });

      expect(res.status).toBe(409);
    });

    it("returns 404 when list not found", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/duplicate`, {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when not owner", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({
        id: listId,
        userId: otherUserId,
        name: "Other's list",
        bookmarks: [],
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/duplicate`, {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });
  });

  // --- DELETE /api/bookmark-lists/:listId ---
  describe("DELETE /api/bookmark-lists/:listId", () => {
    it("deletes own list", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({ id: listId, userId });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
    });

    it("returns 404 when not owner", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({
        id: listId,
        userId: otherUserId,
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when not found", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
