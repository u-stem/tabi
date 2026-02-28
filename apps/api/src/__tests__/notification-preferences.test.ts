import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const { mockGetSession, mockDbQuery, mockDbInsert } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: { notificationPreferences: { findMany: vi.fn() } },
  mockDbInsert: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

import { notificationPreferenceRoutes } from "../routes/notification-preferences";

const fakeUser = { id: "user-1", name: "Test" };

describe("Notification preference routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: fakeUser, session: { id: "s1" } });
    mockDbQuery.notificationPreferences.findMany.mockResolvedValue([]);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it("GET /api/notification-preferences は設定一覧を返す", async () => {
    const app = createTestApp(notificationPreferenceRoutes, "/api/notification-preferences");
    const res = await app.request("/api/notification-preferences");
    expect(res.status).toBe(200);
  });

  it("PUT /api/notification-preferences は設定を更新する", async () => {
    const app = createTestApp(notificationPreferenceRoutes, "/api/notification-preferences");
    const res = await app.request("/api/notification-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "schedule_created", push: false }),
    });
    expect(res.status).toBe(200);
    expect(mockDbInsert).toHaveBeenCalled();
  });
});
