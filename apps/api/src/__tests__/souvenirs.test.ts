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

function mockCountQuery(count: number) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ itemCount: count }]),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/trips/:tripId/souvenirs", () => {
  it("returns own items", async () => {
    setupAuth();
    const items = [{ id: itemId, name: "Tokyo banana", isPurchased: false }];
    mockDbQuery.souvenirItems.findMany.mockResolvedValue(items);

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual(items);
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
    mockCountQuery(0);
    const created = { id: itemId, name: "Tokyo banana", isPurchased: false };
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([created]),
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
  });

  it("creates souvenir item with all optional fields", async () => {
    setupAuth();
    mockCountQuery(0);
    const created = {
      id: itemId,
      name: "Matcha Kit Kat",
      recipient: "Mom",
      urls: ["https://example.com"],
      addresses: ["Shibuya, Tokyo"],
      memo: "Green box",
      isPurchased: false,
    };
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([created]),
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

  it("returns 409 when limit reached", async () => {
    setupAuth();
    mockCountQuery(MAX_SOUVENIRS_PER_USER_PER_TRIP);

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
    const updated = { ...existing, isPurchased: true };
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updated]),
        }),
      }),
    });

    const res = await makeApp().request(`/api/trips/${tripId}/souvenirs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPurchased: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPurchased).toBe(true);
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
});
