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
import { candidateRoutes } from "../../routes/candidates";
import { spotRoutes } from "../../routes/spots";
import { tripRoutes } from "../../routes/trips";
import { cleanupTables, createTestUser, getTestDb, teardownTestDb } from "./setup";

function createApp() {
  const app = new Hono();
  app.route("/api/trips", tripRoutes);
  app.route("/api/trips", spotRoutes);
  app.route("/api/trips", candidateRoutes);
  return app;
}

describe("Candidates Integration", () => {
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

    const res = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Candidate Test Trip",
        destination: "Osaka",
        startDate: "2025-05-01",
        endDate: "2025-05-02",
      }),
    });
    const trip = await res.json();
    tripId = trip.id;

    const detailRes = await app.request(`/api/trips/${tripId}`);
    const detail = await detailRes.json();
    dayId = detail.days[0].id;
    patternId = detail.days[0].patterns[0].id;
  });

  afterAll(async () => {
    await cleanupTables();
    await teardownTestDb();
  });

  it("creates a candidate with sortOrder 0", async () => {
    const res = await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ramen Shop", category: "restaurant" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Ramen Shop");
    expect(body.category).toBe("restaurant");
    expect(body.sortOrder).toBe(0);
    expect(body.dayPatternId).toBeNull();
  });

  it("second candidate gets sortOrder 1", async () => {
    await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "First", category: "sightseeing" }),
    });
    const res = await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Second", category: "restaurant" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sortOrder).toBe(1);
  });

  it("lists candidates sorted by sortOrder", async () => {
    await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A", category: "sightseeing" }),
    });
    await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "B", category: "restaurant" }),
    });

    const res = await app.request(`/api/trips/${tripId}/candidates`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe("A");
    expect(body[1].name).toBe("B");
  });

  it("candidates do not appear in trip detail days", async () => {
    await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Candidate", category: "sightseeing" }),
    });

    const detailRes = await app.request(`/api/trips/${tripId}`);
    const detail = await detailRes.json();

    // Candidate should be in the top-level candidates array
    expect(detail.candidates).toHaveLength(1);
    expect(detail.candidates[0].name).toBe("Candidate");

    // Candidate should NOT appear in any pattern's spots
    for (const day of detail.days) {
      for (const pattern of day.patterns) {
        expect(pattern.spots).toHaveLength(0);
      }
    }
  });

  it("deletes a candidate", async () => {
    const createRes = await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "To Delete", category: "other" }),
    });
    const created = await createRes.json();

    const deleteRes = await app.request(`/api/trips/${tripId}/candidates/${created.id}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(200);

    const listRes = await app.request(`/api/trips/${tripId}/candidates`);
    const list = await listRes.json();
    expect(list).toHaveLength(0);
  });

  it("reorders candidates", async () => {
    const r1 = await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A", category: "sightseeing" }),
    });
    const r2 = await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "B", category: "restaurant" }),
    });
    const s1 = await r1.json();
    const s2 = await r2.json();

    const reorderRes = await app.request(`/api/trips/${tripId}/candidates/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotIds: [s2.id, s1.id] }),
    });
    expect(reorderRes.status).toBe(200);

    const listRes = await app.request(`/api/trips/${tripId}/candidates`);
    const list = await listRes.json();
    expect(list[0].name).toBe("B");
    expect(list[1].name).toBe("A");
  });

  it("assigns a candidate to a pattern", async () => {
    const createRes = await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "To Assign", category: "sightseeing" }),
    });
    const candidate = await createRes.json();

    const assignRes = await app.request(`/api/trips/${tripId}/candidates/${candidate.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayPatternId: patternId }),
    });
    expect(assignRes.status).toBe(200);
    const assigned = await assignRes.json();
    expect(assigned.dayPatternId).toBe(patternId);

    // Should no longer be in candidates
    const listRes = await app.request(`/api/trips/${tripId}/candidates`);
    const candidates = await listRes.json();
    expect(candidates).toHaveLength(0);
  });

  it("unassigns a spot to candidates", async () => {
    // Create a regular spot in the pattern
    const createRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "To Unassign", category: "restaurant", color: "blue" }),
      },
    );
    expect(createRes.status).toBe(201);
    const spot = await createRes.json();

    // Unassign it
    const unassignRes = await app.request(`/api/trips/${tripId}/spots/${spot.id}/unassign`, {
      method: "POST",
    });
    expect(unassignRes.status).toBe(200);
    const unassigned = await unassignRes.json();
    expect(unassigned.dayPatternId).toBeNull();

    // Should now appear in candidates
    const listRes = await app.request(`/api/trips/${tripId}/candidates`);
    const candidates = await listRes.json();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].name).toBe("To Unassign");
  });

  it("viewer cannot create candidates", async () => {
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

    const res = await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Should Fail", category: "other" }),
    });
    expect(res.status).toBe(404);
  });

  it("viewer can list candidates", async () => {
    // Create candidate as owner
    await app.request(`/api/trips/${tripId}/candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Visible", category: "sightseeing" }),
    });

    // Switch to viewer
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

    const res = await app.request(`/api/trips/${tripId}/candidates`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});
