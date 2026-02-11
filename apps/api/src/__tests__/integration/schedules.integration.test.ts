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
import { scheduleRoutes } from "../../routes/schedules";
import { tripRoutes } from "../../routes/trips";
import { cleanupTables, createTestUser, getTestDb, teardownTestDb } from "./setup";

function createApp() {
  const app = new Hono();
  app.route("/api/trips", tripRoutes);
  app.route("/api/trips", patternRoutes);
  app.route("/api/trips", scheduleRoutes);
  return app;
}

describe("Schedules Integration", () => {
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

    // Create a trip to use in schedule tests
    const res = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Schedule Test Trip",
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

  it("creates a schedule with correct sort order", async () => {
    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
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
    const schedule = await res.json();
    expect(schedule.name).toBe("Tokyo Tower");
    expect(schedule.category).toBe("sightseeing");
    expect(schedule.sortOrder).toBe(0);
  });

  it("increments sort order for subsequent schedules", async () => {
    await app.request(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "First", category: "sightseeing" }),
    });

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Second", category: "restaurant" }),
      },
    );

    const schedule = await res.json();
    expect(schedule.sortOrder).toBe(1);
  });

  it("lists schedules ordered by sort_order", async () => {
    await app.request(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A Schedule", category: "sightseeing" }),
    });
    await app.request(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "B Schedule", category: "restaurant" }),
    });

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
    );
    expect(res.status).toBe(200);
    const scheduleList = await res.json();
    expect(scheduleList).toHaveLength(2);
    expect(scheduleList[0].name).toBe("A Schedule");
    expect(scheduleList[1].name).toBe("B Schedule");
  });

  it("reorders schedules", async () => {
    const res1 = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "First", category: "sightseeing" }),
      },
    );
    const schedule1 = await res1.json();

    const res2 = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Second", category: "restaurant" }),
      },
    );
    const schedule2 = await res2.json();

    // Reorder: Second first, then First
    const reorderRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/reorder`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleIds: [schedule2.id, schedule1.id] }),
      },
    );
    expect(reorderRes.status).toBe(200);

    // Verify new order
    const listRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
    );
    const scheduleList = await listRes.json();
    expect(scheduleList[0].name).toBe("Second");
    expect(scheduleList[1].name).toBe("First");
  });

  it("updates a schedule", async () => {
    const createRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Old Name", category: "sightseeing" }),
      },
    );
    const schedule = await createRes.json();

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/${schedule.id}`,
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

  it("deletes a schedule", async () => {
    const createRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Delete Me", category: "other" }),
      },
    );
    const schedule = await createRes.json();

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/${schedule.id}`,
      {
        method: "DELETE",
      },
    );
    expect(res.status).toBe(200);

    // Verify deleted
    const listRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
    );
    const scheduleList = await listRes.json();
    expect(scheduleList).toHaveLength(0);
  });

  it("viewer cannot create schedules", async () => {
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
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Should Fail", category: "sightseeing" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("creates a schedule with address", async () => {
    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tokyo Tower",
          category: "sightseeing",
          address: "4-2-8 Shibakoen, Minato City, Tokyo",
        }),
      },
    );

    expect(res.status).toBe(201);
    const schedule = await res.json();
    expect(schedule.address).toBe("4-2-8 Shibakoen, Minato City, Tokyo");
  });
});
