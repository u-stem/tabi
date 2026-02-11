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

describe("Patterns Integration", () => {
  const app = createApp();
  let owner: { id: string; name: string; email: string };
  let viewer: { id: string; name: string; email: string };
  let tripId: string;
  let dayId: string;
  let defaultPatternId: string;

  beforeEach(async () => {
    await cleanupTables();
    owner = await createTestUser({ name: "Owner", email: "owner@test.com" });
    viewer = await createTestUser({ name: "Viewer", email: "viewer@test.com" });
    mockGetSession.mockImplementation(() => ({
      user: owner,
      session: { id: "test-session" },
    }));

    const res = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Trip",
        destination: "Tokyo",
        startDate: "2026-03-01",
        endDate: "2026-03-02",
      }),
    });
    const trip = await res.json();
    tripId = trip.id;

    const detail = await app.request(`/api/trips/${tripId}`);
    const data = await detail.json();
    dayId = data.days[0].id;
    defaultPatternId = data.days[0].patterns[0].id;

    const db = getTestDb();
    await db.insert(tripMembers).values({
      tripId,
      userId: viewer.id,
      role: "viewer",
    });
  });

  afterAll(async () => {
    await cleanupTables();
    await teardownTestDb();
  });

  it("lists patterns for a day", async () => {
    const res = await app.request(`/api/trips/${tripId}/days/${dayId}/patterns`);
    expect(res.status).toBe(200);
    const patterns = await res.json();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].label).toBe("デフォルト");
    expect(patterns[0].isDefault).toBe(true);
  });

  it("creates a new pattern", async () => {
    const res = await app.request(`/api/trips/${tripId}/days/${dayId}/patterns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Plan B" }),
    });
    expect(res.status).toBe(201);
    const pattern = await res.json();
    expect(pattern.label).toBe("Plan B");
    expect(pattern.isDefault).toBe(false);
    expect(pattern.sortOrder).toBe(1);
  });

  it("updates a pattern label", async () => {
    const createRes = await app.request(`/api/trips/${tripId}/days/${dayId}/patterns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Plan B" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/trips/${tripId}/days/${dayId}/patterns/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Plan B Updated" }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.label).toBe("Plan B Updated");
  });

  it("deletes a non-default pattern", async () => {
    const createRes = await app.request(`/api/trips/${tripId}/days/${dayId}/patterns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Temporary" }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/trips/${tripId}/days/${dayId}/patterns/${created.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const listRes = await app.request(`/api/trips/${tripId}/days/${dayId}/patterns`);
    const patterns = await listRes.json();
    expect(patterns).toHaveLength(1);
  });

  it("rejects deleting the default pattern", async () => {
    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${defaultPatternId}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(400);
  });

  it("duplicates a pattern with schedules", async () => {
    await app.request(`/api/trips/${tripId}/days/${dayId}/patterns/${defaultPatternId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Visit Temple", category: "sightseeing" }),
    });

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${defaultPatternId}/duplicate`,
      { method: "POST" },
    );
    expect(res.status).toBe(201);
    const duplicated = await res.json();
    expect(duplicated.label).toBe("デフォルト (copy)");
    expect(duplicated.isDefault).toBe(false);

    // Verify schedules were copied by listing patterns
    const listRes = await app.request(`/api/trips/${tripId}/days/${dayId}/patterns`);
    const patterns = await listRes.json();
    const copiedPattern = patterns.find((p: { id: string }) => p.id === duplicated.id);
    expect(copiedPattern.schedules).toHaveLength(1);
    expect(copiedPattern.schedules[0].name).toBe("Visit Temple");
  });

  it("rejects pattern creation by viewer", async () => {
    mockGetSession.mockImplementation(() => ({
      user: viewer,
      session: { id: "viewer-session" },
    }));
    const res = await app.request(`/api/trips/${tripId}/days/${dayId}/patterns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Viewer Pattern" }),
    });
    expect(res.status).toBe(404);
  });
});
