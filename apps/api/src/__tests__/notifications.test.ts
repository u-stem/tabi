import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDbQuery, mockDbInsert, mockSendNotification } = vi.hoisted(() => ({
  mockDbQuery: {
    notificationPreferences: { findFirst: vi.fn() },
    pushSubscriptions: { findMany: vi.fn() },
  },
  mockDbInsert: vi.fn(),
  mockSendNotification: vi.fn(),
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

import { createNotification } from "../lib/notifications";

const baseParams = {
  type: "member_added" as const,
  userId: "user-1",
  tripId: "trip-1",
  payload: { actorName: "田中", tripName: "京都旅行" },
};

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbQuery.notificationPreferences.findFirst.mockResolvedValue(null); // no pref = default ON
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockSendNotification.mockResolvedValue({});
  });

  it("preferences が未設定の場合は in_app を DB に INSERT する", async () => {
    await createNotification(baseParams);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("inApp が false の場合は DB INSERT しない", async () => {
    mockDbQuery.notificationPreferences.findFirst.mockResolvedValue({
      inApp: false,
      push: false,
    });
    await createNotification(baseParams);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("push サブスクリプションがある場合は sendNotification を呼ぶ", async () => {
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      { endpoint: "https://fcm.example.com/push/1", p256dh: "abc", auth: "xyz" },
    ]);
    await createNotification(baseParams);
    // sendNotification は非同期 fire-and-forget なので少し待つ
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).toHaveBeenCalled();
  });

  it("push が false の場合は sendNotification を呼ばない", async () => {
    mockDbQuery.notificationPreferences.findFirst.mockResolvedValue({
      inApp: true,
      push: false,
    });
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      { endpoint: "https://fcm.example.com/push/1", p256dh: "abc", auth: "xyz" },
    ]);
    await createNotification(baseParams);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});
