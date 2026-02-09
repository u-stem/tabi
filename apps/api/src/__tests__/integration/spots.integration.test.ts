import { Hono } from "hono";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("../../db/index", async () => {
  const { getTestDb } = await import("./setup");
  return { db: getTestDb() };
});

vi.mock("../../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

import { tripMembers } from "../../db/schema";
import { patternRoutes } from "../../routes/patterns";
import { spotRoutes } from "../../routes/spots";
import { tripRoutes } from "../../routes/trips";
import { cleanupTables, createTestUser, getTestDb, teardownTestDb } from "./setup";

function createApp() {
  const app = new Hono();
  app.route("/api/trips", tripRoutes);
  app.route("/api/trips", patternRoutes);
  app.route("/api/trips", spotRoutes);
  return app;
}

describe("Spots Integration", () => {
  const app = createApp();
  let owner: { id: string; name: string; email: string };
  let tripId: string;
  let dayId: string;
  let patternId: string;

  beforeEach(async () => {
    await cleanupTables();
    owner = await createTestUser({ name: "Owner", email: "owner@test.com" });
    mockGetSession.mockImplementation(() => ({
      user: owner,
      session: { id: "test-session" },
    }));

    // Create a trip to use in spot tests
    const res = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Spot Test Trip",
        destination: "Tokyo",
        startDate: "2025-04-01",
        endDate: "2025-04-02",
      }),
    });
    const trip = await res.json();
    tripId = trip.id;

    // Get day ID and default pattern ID from trip detail
    const detailRes = await app.request(`/api/trips/${tripId}`);
    const detail = await detailRes.json();
    dayId = detail.days[0].id;
    patternId = detail.days[0].patterns[0].id;
  });

  afterAll(async () => {
    await cleanupTables();
    await teardownTestDb();
  });

  it("creates a spot with correct sort order", async () => {
    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tokyo Tower",
          category: "sightseeing",
        }),
      },
    );

    expect(res.status).toBe(201);
    const spot = await res.json();
    expect(spot.name).toBe("Tokyo Tower");
    expect(spot.category).toBe("sightseeing");
    expect(spot.sortOrder).toBe(0);
  });

  it("increments sort order for subsequent spots", async () => {
    await app.request(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "First", category: "sightseeing" }),
    });

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Second", category: "restaurant" }),
      },
    );

    const spot = await res.json();
    expect(spot.sortOrder).toBe(1);
  });

  it("lists spots ordered by sort_order", async () => {
    await app.request(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A Spot", category: "sightseeing" }),
    });
    await app.request(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "B Spot", category: "restaurant" }),
    });

    const res = await app.request(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`);
    expect(res.status).toBe(200);
    const spots = await res.json();
    expect(spots).toHaveLength(2);
    expect(spots[0].name).toBe("A Spot");
    expect(spots[1].name).toBe("B Spot");
  });

  it("reorders spots", async () => {
    const res1 = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "First", category: "sightseeing" }),
      },
    );
    const spot1 = await res1.json();

    const res2 = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Second", category: "restaurant" }),
      },
    );
    const spot2 = await res2.json();

    // Reorder: Second first, then First
    const reorderRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/reorder`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotIds: [spot2.id, spot1.id] }),
      },
    );
    expect(reorderRes.status).toBe(200);

    // Verify new order
    const listRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
    );
    const spots = await listRes.json();
    expect(spots[0].name).toBe("Second");
    expect(spots[1].name).toBe("First");
  });

  it("updates a spot", async () => {
    const createRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Old Name", category: "sightseeing" }),
      },
    );
    const spot = await createRes.json();

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/${spot.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name", memo: "Updated memo" }),
      },
    );
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.name).toBe("New Name");
    expect(updated.memo).toBe("Updated memo");
  });

  it("deletes a spot", async () => {
    const createRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Delete Me", category: "other" }),
      },
    );
    const spot = await createRes.json();

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/${spot.id}`,
      {
        method: "DELETE",
      },
    );
    expect(res.status).toBe(200);

    // Verify deleted
    const listRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
    );
    const spots = await listRes.json();
    expect(spots).toHaveLength(0);
  });

  it("viewer cannot create spots", async () => {
    const viewer = await createTestUser({ name: "Viewer", email: "viewer@test.com" });
    const db = getTestDb();
    await db.insert(tripMembers).values({
      tripId,
      userId: viewer.id,
      role: "viewer",
    });

    mockGetSession.mockImplementation(() => ({
      user: viewer,
      session: { id: "viewer-session" },
    }));

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Should Fail", category: "sightseeing" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("creates a spot with coordinates", async () => {
    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tokyo Tower",
          category: "sightseeing",
          latitude: 35.6585805,
          longitude: 139.7454329,
          address: "4-2-8 Shibakoen, Minato City, Tokyo",
        }),
      },
    );

    expect(res.status).toBe(201);
    const spot = await res.json();
    expect(spot.address).toBe("4-2-8 Shibakoen, Minato City, Tokyo");
    expect(Number(spot.latitude)).toBeCloseTo(35.6585805, 5);
    expect(Number(spot.longitude)).toBeCloseTo(139.7454329, 5);
  });
});
