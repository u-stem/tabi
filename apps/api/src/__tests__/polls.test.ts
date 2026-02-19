import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockDbSelect, mockDbInsert, mockDbUpdate, mockFindPollAsOwner } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockFindPollAsOwner: vi.fn(),
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
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
  },
}));

vi.mock("../lib/poll-access", () => ({
  findPollAsOwner: (...args: unknown[]) => mockFindPollAsOwner(...args),
}));

vi.mock("../lib/activity-logger", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
  formatShortDateRange: vi.fn().mockReturnValue("2/5〜2/7"),
}));

import { ERROR_MSG } from "../lib/constants";
import { pollRoutes } from "../routes/polls";
import { createTestApp, TEST_USER } from "./test-helpers";

const fakeUser = TEST_USER;

describe("Poll routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
  });

  describe("POST /api/polls/:pollId/options", () => {
    it("returns 409 when option with same dates already exists", async () => {
      mockFindPollAsOwner.mockResolvedValue({
        id: "poll-1",
        ownerId: fakeUser.id,
        status: "open",
        tripId: "trip-1",
      });

      // First select: option count
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });
      // Second select: duplicate check
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "existing-opt" }]),
        }),
      });

      const app = createTestApp(pollRoutes, "/api/polls");
      const res = await app.request("/api/polls/poll-1/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: "2026-02-05",
          endDate: "2026-02-07",
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe(ERROR_MSG.POLL_OPTION_DUPLICATE);
    });

    it("returns 201 when dates are unique", async () => {
      mockFindPollAsOwner.mockResolvedValue({
        id: "poll-1",
        ownerId: fakeUser.id,
        status: "open",
        tripId: "trip-1",
      });

      // First select: option count
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });
      // Second select: duplicate check - no match
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "new-opt",
              pollId: "poll-1",
              startDate: "2026-02-05",
              endDate: "2026-02-07",
              sortOrder: 1,
            },
          ]),
        }),
      });

      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const app = createTestApp(pollRoutes, "/api/polls");
      const res = await app.request("/api/polls/poll-1/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: "2026-02-05",
          endDate: "2026-02-07",
        }),
      });

      expect(res.status).toBe(201);
    });
  });
});
