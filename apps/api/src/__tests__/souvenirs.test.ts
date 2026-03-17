import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete, mockDbSelect } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockDbQuery: {
      souvenirItems: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      tripMembers: {
        findFirst: vi.fn(),
      },
    },
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbSelect: vi.fn(),
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
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

import { MAX_SOUVENIRS_PER_USER_PER_TRIP } from "@sugara/shared";
import { souvenirRoutes } from "../routes/souvenirs";
import { createTestApp, TEST_USER } from "./test-helpers";

const fakeUser = TEST_USER;
const tripId = "trip-1";
const itemId = "00000000-0000-0000-0000-000000000001";

function setupAuth() {
  mockGetSession.mockResolvedValue({
    user: fakeUser,
    session: { id: "session-1" },
  });
  mockDbQuery.tripMembers.findFirst.mockResolvedValue({
    tripId,
    userId: fakeUser.id,
    role: "owner",
  });
}

function makeApp() {
  return createTestApp(souvenirRoutes, "/api/trips");
}

// Mock for GET: .from().innerJoin().where().orderBy()
function mockGetSelectQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  };
}

// Mock for findSouvenirWithUser: .from().innerJoin().where() → resolves to rows
function mockFindByIdSelectQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function mockCountAndFindQuery(count: number, enrichedItem: Record<string, unknown>) {
  // First call: count query (.from().where())
  // Second call: findSouvenirWithUser (.from().innerJoin().where())
  mockDbSelect
    .mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ itemCount: count }]),
      }),
    })
    .mockReturnValueOnce(mockFindByIdSelectQuery([enrichedItem]));
}

function mockFindSouvenirQuery(enrichedItem: Record<string, unknown>) {
  mockDbSelect.mockReturnValueOnce(mockFindByIdSelectQuery([enrichedItem]));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/trips/:tripId/souvenirs", () => {
  it("returns own items with user info", async () => {
    setupAuth();
    const items = [
      {
        id: itemId,
        name: "Tokyo banana",
        isPurchased: false,
        isShared: false,
        userId: fakeUser.id,
        userName: fakeUser.name,
        userImage: null,
      },
    ];
    mockDbSelect.mockReturnValueOnce(mockGetSelectQuery(items));

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual(items);
    expect(body.items[0].userId).toBe(fakeUser.id);
    expect(body.items[0].userName).toBe(fakeUser.name);
  });

  it("returns other members' shared items", async () => {
    setupAuth();
    const otherUserId = "user-2";
    const items = [
      {
        id: itemId,
        name: "My souvenir",
        isShared: false,
        userId: fakeUser.id,
        userName: fakeUser.name,
        userImage: null,
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        name: "Shared souvenir",
        isShared: true,
        userId: otherUserId,
        userName: "Other User",
        userImage: "https://example.com/avatar.png",
      },
    ];
    mockDbSelect.mockReturnValueOnce(mockGetSelectQuery(items));

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[1].userId).toBe(otherUserId);
    expect(body.items[1].userName).toBe("Other User");
    expect(body.items[1].userImage).toBe("https://example.com/avatar.png");
  });

  it("returns 401 without auth", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/trips/:tripId/souvenirs", () => {
  it("creates souvenir item with name only", async () => {
    setupAuth();
    const enriched = {
      id: itemId,
      name: "Tokyo banana",
      isPurchased: false,
      isShared: false,
      userId: fakeUser.id,
      userName: fakeUser.name,
      userImage: null,
    };
    mockCountAndFindQuery(0, enriched);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: itemId }]),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tokyo banana" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Tokyo banana");
    expect(body.userName).toBe(fakeUser.name);
    expect(body.userId).toBe(fakeUser.id);
  });

  it("creates souvenir item with all optional fields", async () => {
    setupAuth();
    const enriched = {
      id: itemId,
      name: "Matcha Kit Kat",
      recipient: "Mom",
      urls: ["https://example.com"],
      addresses: ["Shibuya, Tokyo"],
      memo: "Green box",
      isPurchased: false,
      isShared: false,
      userId: fakeUser.id,
      userName: fakeUser.name,
      userImage: null,
    };
    mockCountAndFindQuery(0, enriched);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: itemId }]),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Matcha Kit Kat",
        recipient: "Mom",
        urls: ["https://example.com"],
        addresses: ["Shibuya, Tokyo"],
        memo: "Green box",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.urls).toEqual(["https://example.com"]);
    expect(body.addresses).toEqual(["Shibuya, Tokyo"]);
    expect(body.userName).toBe(fakeUser.name);
  });

  it("creates souvenir item with isShared=true", async () => {
    setupAuth();
    const enriched = {
      id: itemId,
      name: "Tokyo banana",
      isPurchased: false,
      isShared: true,
      shareStyle: null,
      userId: fakeUser.id,
      userName: fakeUser.name,
      userImage: null,
    };
    mockCountAndFindQuery(0, enriched);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: itemId }]),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tokyo banana", isShared: true }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.isShared).toBe(true);
    expect(body.shareStyle).toBeNull();
  });

  it("creates souvenir item with isShared=true and shareStyle=errand", async () => {
    setupAuth();
    const enriched = {
      id: itemId,
      name: "Tokyo banana",
      isPurchased: false,
      isShared: true,
      shareStyle: "errand",
      userId: fakeUser.id,
      userName: fakeUser.name,
      userImage: null,
    };
    mockCountAndFindQuery(0, enriched);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: itemId }]),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tokyo banana", isShared: true, shareStyle: "errand" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.shareStyle).toBe("errand");
  });

  it("returns 400 for empty name", async () => {
    setupAuth();
    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates souvenir item with priority", async () => {
    setupAuth();
    const enriched = {
      id: itemId,
      name: "Tokyo banana",
      priority: "high",
      isPurchased: false,
      isShared: false,
      userId: fakeUser.id,
      userName: fakeUser.name,
      userImage: null,
    };
    mockCountAndFindQuery(0, enriched);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: itemId }]),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tokyo banana", priority: "high" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.priority).toBe("high");
  });

  it("returns 409 when limit reached", async () => {
    setupAuth();
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ itemCount: MAX_SOUVENIRS_PER_USER_PER_TRIP }]),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "One more souvenir" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/trips/:tripId/souvenirs/:itemId", () => {
  it("marks item as purchased", async () => {
    setupAuth();
    const existing = { id: itemId, name: "Tokyo banana", isPurchased: false, userId: fakeUser.id };
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(existing);
    const enriched = {
      ...existing,
      isPurchased: true,
      isShared: false,
      userName: fakeUser.name,
      userImage: null,
    };
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockFindSouvenirQuery(enriched);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPurchased: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPurchased).toBe(true);
    expect(body.userName).toBe(fakeUser.name);
  });

  it("updates isShared to true", async () => {
    setupAuth();
    const existing = {
      id: itemId,
      name: "Tokyo banana",
      isShared: false,
      userId: fakeUser.id,
    };
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(existing);
    const enriched = {
      ...existing,
      isShared: true,
      isPurchased: false,
      userName: fakeUser.name,
      userImage: null,
    };
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockFindSouvenirQuery(enriched);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isShared: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isShared).toBe(true);
  });

  it("returns 404 for non-existent or other user's item", async () => {
    setupAuth();
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(null);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPurchased: true }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when other member tries to update shared item", async () => {
    setupAuth();
    // findFirst with userId=fakeUser.id returns null because the item belongs to another user
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(null);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPurchased: true }),
    });
    expect(res.status).toBe(404);
  });

  it("resets shareStyle to null when isShared set to false", async () => {
    setupAuth();
    const existing = {
      id: itemId,
      name: "Tokyo banana",
      isShared: true,
      shareStyle: "recommend",
      userId: fakeUser.id,
    };
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(existing);
    const enriched = {
      ...existing,
      isShared: false,
      shareStyle: null,
      isPurchased: false,
      userName: fakeUser.name,
      userImage: null,
    };
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockFindSouvenirQuery(enriched);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isShared: false }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isShared).toBe(false);
    expect(body.shareStyle).toBeNull();
  });

  it("updates shareStyle to errand", async () => {
    setupAuth();
    const existing = {
      id: itemId,
      name: "Tokyo banana",
      isShared: true,
      shareStyle: "recommend",
      userId: fakeUser.id,
    };
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(existing);
    const enriched = {
      ...existing,
      shareStyle: "errand",
      isPurchased: false,
      userName: fakeUser.name,
      userImage: null,
    };
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockFindSouvenirQuery(enriched);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareStyle: "errand" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shareStyle).toBe("errand");
  });

  it("resets priority to null", async () => {
    setupAuth();
    const existing = {
      id: itemId,
      name: "Tokyo banana",
      priority: "high",
      isPurchased: false,
      userId: fakeUser.id,
    };
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(existing);
    const enriched = {
      ...existing,
      priority: null,
      isShared: false,
      userName: fakeUser.name,
      userImage: null,
    };
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockFindSouvenirQuery(enriched);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: null }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.priority).toBeNull();
  });

  it("returns 400 for empty update body", async () => {
    setupAuth();
    const existing = { id: itemId, name: "Tokyo banana", isPurchased: false, userId: fakeUser.id };
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(existing);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/trips/:tripId/souvenirs/:itemId", () => {
  it("deletes item and returns 204", async () => {
    setupAuth();
    const existing = { id: itemId, name: "Tokyo banana", isPurchased: false, userId: fakeUser.id };
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(existing);
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);
  });

  it("returns 404 for non-existent or other user's item", async () => {
    setupAuth();
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(null);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when other member tries to delete shared item", async () => {
    setupAuth();
    // findFirst with userId=fakeUser.id returns null because the item belongs to another user
    mockDbQuery.souvenirItems.findFirst.mockResolvedValue(null);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
