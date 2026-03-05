import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, TEST_USER } from "./test-helpers";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(
  () => ({
    mockGetSession: vi.fn(),
    mockDbQuery: {
      quickPolls: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      quickPollOptions: {
        findMany: vi.fn(),
      },
      quickPollVotes: {
        findMany: vi.fn(),
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

vi.mock("../db/index", () => {
  const tx = {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  };
  return {
    db: { ...tx, transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
  };
});

import { quickPollRoutes } from "../routes/quick-polls";

const fakeUser = TEST_USER;
const app = createTestApp(quickPollRoutes, "/api/quick-polls");

describe("Quick Poll routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
  });

  describe("POST /api/quick-polls", () => {
    it("should create a poll with options", async () => {
      mockDbQuery.quickPolls.findMany.mockResolvedValue([]);
      const mockReturning = vi.fn().mockResolvedValue([{ id: "poll-1", shareToken: "abc123" }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDbInsert.mockReturnValue({ values: mockValues });

      const res = await app.request("/api/quick-polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Sushi or Ramen?",
          options: [{ label: "Sushi" }, { label: "Ramen" }],
        }),
      });

      expect(res.status).toBe(201);
    });

    it("should reject with less than 2 options", async () => {
      const res = await app.request("/api/quick-polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Only one?",
          options: [{ label: "Solo" }],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      mockGetSession.mockResolvedValue(null);

      const res = await app.request("/api/quick-polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Q?",
          options: [{ label: "A" }, { label: "B" }],
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/quick-polls", () => {
    it("should return user's polls", async () => {
      mockDbQuery.quickPolls.findMany.mockResolvedValue([
        {
          id: "poll-1",
          question: "A or B?",
          status: "open",
          shareToken: "abc",
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          options: [{ id: "o1", label: "A", sortOrder: 0 }],
          votes: [],
        },
      ]);

      const res = await app.request("/api/quick-polls");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
    });
  });

  describe("PATCH /api/quick-polls/:id", () => {
    it("should close a poll", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue({
        id: "poll-1",
        creatorId: fakeUser.id,
        status: "open",
      });
      const mockReturning = vi.fn().mockResolvedValue([{ id: "poll-1" }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDbUpdate.mockReturnValue({ set: mockSet });

      const res = await app.request("/api/quick-polls/poll-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });

      expect(res.status).toBe(200);
    });

    it("should reject non-creator", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue(null);

      const res = await app.request("/api/quick-polls/poll-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/quick-polls/:id", () => {
    it("should delete creator's poll", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue({
        id: "poll-1",
        creatorId: fakeUser.id,
      });
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      mockDbDelete.mockReturnValue({ where: mockWhere });

      const res = await app.request("/api/quick-polls/poll-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });
  });
});
