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

  it("returns 409 when expectedUpdatedAt does not match (conflict)", async () => {
    const createRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Conflict Test", category: "sightseeing" }),
      },
    );
    const schedule = await createRes.json();

    // First update succeeds
    const firstUpdate = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/${schedule.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name",
          expectedUpdatedAt: schedule.updatedAt,
        }),
      },
    );
    expect(firstUpdate.status).toBe(200);

    // Second update with stale updatedAt fails
    const secondUpdate = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/${schedule.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Stale Update",
          expectedUpdatedAt: schedule.updatedAt,
        }),
      },
    );
    expect(secondUpdate.status).toBe(409);
  });

  it("skips conflict check when expectedUpdatedAt is omitted", async () => {
    const createRes = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "No Conflict", category: "sightseeing" }),
      },
    );
    const schedule = await createRes.json();

    const res = await app.request(
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/${schedule.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Without Lock" }),
      },
    );
    expect(res.status).toBe(200);
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

  describe("batch-shift", () => {
    const batchShiftUrl = () =>
      `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/batch-shift`;

    async function createSchedule(
      name: string,
      category: string,
      overrides?: Record<string, unknown>,
    ) {
      const res = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, category, ...overrides }),
        },
      );
      return res.json();
    }

    it("shifts start and end times of multiple schedules", async () => {
      const s1 = await createSchedule("Lunch", "restaurant", {
        startTime: "12:00",
        endTime: "13:00",
      });
      const s2 = await createSchedule("Museum", "sightseeing", {
        startTime: "14:00",
        endTime: "16:00",
      });

      const res = await app.request(batchShiftUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: [s1.id, s2.id],
          deltaMinutes: 30,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.updatedCount).toBe(2);
      expect(body.skippedCount).toBe(0);

      const listRes = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      );
      const list = await listRes.json();
      const lunch = list.find((s: { id: string }) => s.id === s1.id);
      const museum = list.find((s: { id: string }) => s.id === s2.id);
      expect(lunch.startTime).toBe("12:30");
      expect(lunch.endTime).toBe("13:30");
      expect(museum.startTime).toBe("14:30");
      expect(museum.endTime).toBe("16:30");
    });

    it("skips hotel with endDayOffset > 0", async () => {
      const hotel = await createSchedule("Hotel Stay", "hotel", {
        startTime: "15:00",
        endTime: "10:00",
        endDayOffset: 1,
      });

      const res = await app.request(batchShiftUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: [hotel.id],
          deltaMinutes: 30,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.updatedCount).toBe(0);
      expect(body.skippedCount).toBe(1);
    });

    it("skips schedules that would exceed 23:59", async () => {
      const late = await createSchedule("Late Event", "activity", {
        startTime: "23:50",
      });

      const res = await app.request(batchShiftUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: [late.id],
          deltaMinutes: 15,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.updatedCount).toBe(0);
      expect(body.skippedCount).toBe(1);
    });

    it("skips schedules without any time set", async () => {
      const noTime = await createSchedule("No Time", "sightseeing");

      const res = await app.request(batchShiftUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: [noTime.id],
          deltaMinutes: 15,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.updatedCount).toBe(0);
      expect(body.skippedCount).toBe(1);
    });

    it("returns 404 when schedule does not belong to pattern", async () => {
      const res = await app.request(batchShiftUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: ["00000000-0000-0000-0000-000000000000"],
          deltaMinutes: 15,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for viewer role", async () => {
      const s1 = await createSchedule("Cafe", "restaurant", {
        startTime: "10:00",
      });

      const viewer = await createTestUser({ name: "Viewer2", email: "viewer2@test.com" });
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

      const res = await app.request(batchShiftUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: [s1.id],
          deltaMinutes: 15,
        }),
      });

      expect(res.status).toBe(404);
    });

    it("skips schedules that would go before 00:00", async () => {
      const early = await createSchedule("Early Walk", "activity", {
        startTime: "00:10",
      });

      const res = await app.request(batchShiftUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: [early.id],
          deltaMinutes: -20,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.updatedCount).toBe(0);
      expect(body.skippedCount).toBe(1);
    });

    it("returns 400 for deltaMinutes of 0", async () => {
      const s1 = await createSchedule("Cafe", "restaurant", {
        startTime: "10:00",
      });

      const res = await app.request(batchShiftUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: [s1.id],
          deltaMinutes: 0,
        }),
      });

      expect(res.status).toBe(400);
    });

    it("updates some and skips others in a mixed batch", async () => {
      const shiftable = await createSchedule("Lunch", "restaurant", {
        startTime: "12:00",
        endTime: "13:00",
      });
      const tooLate = await createSchedule("Late Event", "activity", {
        startTime: "23:50",
      });

      const res = await app.request(batchShiftUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: [shiftable.id, tooLate.id],
          deltaMinutes: 15,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.updatedCount).toBe(1);
      expect(body.skippedCount).toBe(1);
    });

    it("does not shift endTime when endDayOffset > 0", async () => {
      const overnight = await createSchedule("Night Bus", "transport", {
        startTime: "22:00",
        endTime: "06:00",
        endDayOffset: 1,
      });

      const res = await app.request(batchShiftUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleIds: [overnight.id],
          deltaMinutes: -30,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.updatedCount).toBe(1);

      const listRes = await app.request(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
      );
      const list = await listRes.json();
      const bus = list.find((s: { id: string }) => s.id === overnight.id);
      expect(bus.startTime).toBe("21:30");
      expect(bus.endTime).toBe("06:00");
    });
  });
});
