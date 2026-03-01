import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const { mockGetSession, mockDbInsert, mockDbDelete, mockDbSelect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

vi.mock("../db/index", () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

import { pushSubscriptionRoutes } from "../routes/push-subscriptions";

const fakeUser = { id: "user-1", name: "Test" };
const validBody = {
  endpoint: "https://fcm.googleapis.com/push/1",
  p256dh: "abc123",
  auth: "xyz789",
};

describe("Push subscription routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: fakeUser, session: { id: "s1" } });
    mockDbInsert.mockReturnValue({
      values: vi
        .fn()
        .mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }),
    });
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 3 }]) }),
    });
  });

  it("POST /api/push-subscriptions はサブスクリプションを保存する", async () => {
    const app = createTestApp(pushSubscriptionRoutes, "/api/push-subscriptions");
    const res = await app.request("/api/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(201);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("DELETE /api/push-subscriptions はサブスクリプションを削除する", async () => {
    const app = createTestApp(pushSubscriptionRoutes, "/api/push-subscriptions");
    const res = await app.request("/api/push-subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: validBody.endpoint }),
    });
    expect(res.status).toBe(200);
    expect(mockDbDelete).toHaveBeenCalled();
  });
});
