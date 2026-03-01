import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDbQuery, mockDbInsert, mockDbSelect, mockDbDelete, mockSendNotification } = vi.hoisted(
  () => ({
    mockDbQuery: {
      notificationPreferences: { findFirst: vi.fn() },
      pushSubscriptions: { findMany: vi.fn() },
      notifications: { findMany: vi.fn() },
    },
    mockDbInsert: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbDelete: vi.fn(),
    mockSendNotification: vi.fn(),
  }),
);

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
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
    mockDbQuery.notifications.findMany.mockResolvedValue([]);
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    // pruneOldNotifications uses db.select().from().where() chain
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });
    mockDbDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockSendNotification.mockResolvedValue({});
  });

  it("preferences が未設定の場合は in_app を DB に INSERT する", async () => {
    await createNotification(baseParams);
    expect(mockDbInsert).toHaveBeenCalled();
  });

  it("inApp が false の場合は DB INSERT しない", async () => {
    mockDbQuery.notificationPreferences.findFirst.mockResolvedValue({
      inApp: false,
    });
    await createNotification(baseParams);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("push サブスクリプションがある場合は sendNotification を呼ぶ", async () => {
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      { endpoint: "https://fcm.example.com/push/1", p256dh: "abc", auth: "xyz", preferences: {} },
    ]);
    await createNotification(baseParams); // member_added, default push=true
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).toHaveBeenCalled();
  });

  it("subscription の preferences[type] が false の場合は sendNotification をスキップする", async () => {
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      {
        endpoint: "https://fcm.example.com/push/1",
        p256dh: "abc",
        auth: "xyz",
        preferences: { member_added: false },
      },
    ]);
    await createNotification(baseParams); // member_added
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("複数サブスクリプション: 有効なものだけ sendNotification を呼ぶ", async () => {
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      {
        endpoint: "https://fcm.example.com/push/1",
        p256dh: "abc",
        auth: "xyz",
        preferences: { member_added: false },
      },
      {
        endpoint: "https://fcm.example.com/push/2",
        p256dh: "def",
        auth: "uvw",
        preferences: {},
      },
    ]);
    await createNotification(baseParams); // member_added, default push=true
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
  });

  it("preferences が {} で NOTIFICATION_DEFAULTS.push=false の場合は sendNotification をスキップする", async () => {
    mockDbQuery.pushSubscriptions.findMany.mockResolvedValue([
      {
        endpoint: "https://fcm.example.com/push/1",
        p256dh: "abc",
        auth: "xyz",
        preferences: {},
      },
    ]);
    // schedule_created has push=false by default
    await createNotification({ ...baseParams, type: "schedule_created" });
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});
