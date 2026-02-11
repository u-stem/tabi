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

import { eq } from "drizzle-orm";
import { tripDays, tripMembers } from "../../db/schema";
import { memberRoutes } from "../../routes/members";
import { patternRoutes } from "../../routes/patterns";
import { scheduleRoutes } from "../../routes/schedules";
import { tripRoutes } from "../../routes/trips";
import { cleanupTables, createTestUser, getTestDb, teardownTestDb } from "./setup";

function createApp() {
  const app = new Hono();
  app.route("/api/trips", tripRoutes);
  app.route("/api/trips", memberRoutes);
  app.route("/api/trips", patternRoutes);
  app.route("/api/trips", scheduleRoutes);
  return app;
}

describe("Trips Integration", () => {
  const app = createApp();
  let owner: { id: string; name: string; email: string };

  beforeEach(async () => {
    await cleanupTables();
    owner = await createTestUser({ name: "Owner", email: "owner@test.com" });
    mockGetSession.mockImplementation(() => ({
      user: owner,
      session: { id: "test-session" },
    }));
  });

  afterAll(async () => {
    await cleanupTables();
    await teardownTestDb();
  });

  it("creates a trip with auto-generated days and owner membership", async () => {
    const res = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Tokyo Trip",
        destination: "Tokyo",
        startDate: "2025-04-01",
        endDate: "2025-04-03",
      }),
    });

    expect(res.status).toBe(201);
    const trip = await res.json();
    expect(trip.title).toBe("Tokyo Trip");
    expect(trip.destination).toBe("Tokyo");
    expect(trip.status).toBe("draft");

    const db = getTestDb();

    const days = await db.query.tripDays.findMany({
      where: eq(tripDays.tripId, trip.id),
    });
    expect(days).toHaveLength(3);

    const members = await db.query.tripMembers.findMany({
      where: eq(tripMembers.tripId, trip.id),
    });
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(owner.id);
    expect(members[0].role).toBe("owner");
  });

  it("lists only trips where the user is a member", async () => {
    const otherUser = await createTestUser({ name: "Other", email: "other@test.com" });

    // Create trip as owner
    await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Owner Trip",
        destination: "Tokyo",
        startDate: "2025-04-01",
        endDate: "2025-04-01",
      }),
    });

    // Create trip as other user
    mockGetSession.mockImplementation(() => ({
      user: otherUser,
      session: { id: "test-session-2" },
    }));

    await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Other Trip",
        destination: "Osaka",
        startDate: "2025-05-01",
        endDate: "2025-05-01",
      }),
    });

    // List as owner - should only see owner's trip
    mockGetSession.mockImplementation(() => ({
      user: owner,
      session: { id: "test-session" },
    }));

    const res = await app.request("/api/trips");
    expect(res.status).toBe(200);
    const trips = await res.json();
    expect(trips).toHaveLength(1);
    expect(trips[0].title).toBe("Owner Trip");
  });

  it("returns totalSchedules in trip list", async () => {
    const createRes = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Count Trip",
        destination: "Tokyo",
        startDate: "2025-04-01",
        endDate: "2025-04-01",
      }),
    });
    const trip = await createRes.json();

    // Get dayId and patternId
    const detailRes = await app.request(`/api/trips/${trip.id}`);
    const detail = await detailRes.json();
    const dayId = detail.days[0].id;
    const patternId = detail.days[0].patterns[0].id;

    // Add 2 schedules
    for (const name of ["Spot A", "Spot B"]) {
      await app.request(`/api/trips/${trip.id}/days/${dayId}/patterns/${patternId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category: "sightseeing" }),
      });
    }

    const listRes = await app.request("/api/trips");
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const target = list.find((t: { id: string }) => t.id === trip.id);
    expect(target.totalSchedules).toBe(2);
  });

  it("gets trip detail with days and spots", async () => {
    const createRes = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Detail Trip",
        destination: "Kyoto",
        startDate: "2025-06-01",
        endDate: "2025-06-02",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/trips/${created.id}`);
    expect(res.status).toBe(200);
    const trip = await res.json();
    expect(trip.title).toBe("Detail Trip");
    expect(trip.days).toHaveLength(2);
    expect(trip.days[0].dayNumber).toBe(1);
    expect(trip.days[1].dayNumber).toBe(2);
    expect(trip.days[0].patterns).toHaveLength(1);
    expect(trip.days[0].patterns[0].label).toBe("デフォルト");
    expect(trip.days[0].patterns[0].isDefault).toBe(true);
  });

  it("updates trip status", async () => {
    const createRes = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Status Trip",
        destination: "Nara",
        startDate: "2025-07-01",
        endDate: "2025-07-01",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/trips/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "planned" }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.status).toBe("planned");
  });

  it("deletes trip and cascades to days and members", async () => {
    const createRes = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Delete Me",
        destination: "Hiroshima",
        startDate: "2025-08-01",
        endDate: "2025-08-02",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/trips/${created.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const db = getTestDb();
    const days = await db.query.tripDays.findMany({
      where: eq(tripDays.tripId, created.id),
    });
    expect(days).toHaveLength(0);

    const members = await db.query.tripMembers.findMany({
      where: eq(tripMembers.tripId, created.id),
    });
    expect(members).toHaveLength(0);
  });

  it("viewer cannot update trip", async () => {
    const createRes = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Viewer Test",
        destination: "Fukuoka",
        startDate: "2025-09-01",
        endDate: "2025-09-01",
      }),
    });
    const created = await createRes.json();

    // Add viewer
    const viewer = await createTestUser({ name: "Viewer", email: "viewer@test.com" });
    const db = getTestDb();
    await db.insert(tripMembers).values({
      tripId: created.id,
      userId: viewer.id,
      role: "viewer",
    });

    // Switch to viewer
    mockGetSession.mockImplementation(() => ({
      user: viewer,
      session: { id: "viewer-session" },
    }));

    const res = await app.request(`/api/trips/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hacked" }),
    });
    expect(res.status).toBe(404);
  });

  it("non-member cannot access trip", async () => {
    const createRes = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Private Trip",
        destination: "Sapporo",
        startDate: "2025-10-01",
        endDate: "2025-10-01",
      }),
    });
    const created = await createRes.json();

    // Switch to non-member
    const stranger = await createTestUser({ name: "Stranger", email: "stranger@test.com" });
    mockGetSession.mockImplementation(() => ({
      user: stranger,
      session: { id: "stranger-session" },
    }));

    const res = await app.request(`/api/trips/${created.id}`);
    expect(res.status).toBe(404);
  });

  it("rejects date changes in update", async () => {
    const createRes = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Date Test",
        destination: "Okinawa",
        startDate: "2025-11-01",
        endDate: "2025-11-01",
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/trips/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: "2025-12-01" }),
    });
    expect(res.status).toBe(400);
  });
});
