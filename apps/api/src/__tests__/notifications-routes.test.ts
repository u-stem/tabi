import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const { mockGetSession, mockDbQuery, mockDbUpdate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    notifications: { findMany: vi.fn() },
  },
  mockDbUpdate: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ unreadCount: 0 }]) }),
    }),
  },
}));

import { notificationRoutes } from "../routes/notifications";

const fakeUser = { id: "user-1", name: "Test" };

describe("Notification routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: fakeUser, session: { id: "s1" } });
    mockDbQuery.notifications.findMany.mockResolvedValue([]);
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it("GET /api/notifications は認証が必要", async () => {
    mockGetSession.mockResolvedValue(null);
    const app = createTestApp(notificationRoutes, "/api/notifications");
    const res = await app.request("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("GET /api/notifications は通知一覧を返す", async () => {
    const app = createTestApp(notificationRoutes, "/api/notifications");
    const res = await app.request("/api/notifications");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("notifications");
    expect(body).toHaveProperty("unreadCount");
  });

  it("PUT /api/notifications/read-all は全件既読にする", async () => {
    const app = createTestApp(notificationRoutes, "/api/notifications");
    const res = await app.request("/api/notifications/read-all", { method: "PUT" });
    expect(res.status).toBe(200);
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});
