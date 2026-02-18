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
import {
  schedulePollOptions,
  schedulePollParticipants,
  schedulePollResponses,
  schedulePolls,
  tripDays,
  tripMembers,
} from "../../db/schema";
import { pollShareRoutes } from "../../routes/poll-share";
import { pollRoutes } from "../../routes/polls";
import { tripRoutes } from "../../routes/trips";
import { cleanupTables, createTestUser, getTestDb, teardownTestDb } from "./setup";

function createApp() {
  const app = new Hono();
  app.route("/api/trips", tripRoutes);
  app.route("/api/polls", pollRoutes);
  app.route("/", pollShareRoutes);
  return app;
}

function json(body: unknown) {
  return {
    method: "POST" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function patch(body: unknown) {
  return {
    method: "PATCH" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function put(body: unknown) {
  return {
    method: "PUT" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

const VALID_POLL = {
  title: "Summer Trip",
  destination: "Okinawa",
  options: [
    { startDate: "2025-07-01", endDate: "2025-07-03" },
    { startDate: "2025-07-10", endDate: "2025-07-12" },
  ],
};

describe("Polls Integration", () => {
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
  });

  // --- CRUD ---

  it("creates a poll with options and auto-adds owner as participant", async () => {
    const res = await app.request("/api/polls", json(VALID_POLL));

    expect(res.status).toBe(201);
    const poll = await res.json();
    expect(poll.title).toBe("Summer Trip");
    expect(poll.destination).toBe("Okinawa");
    expect(poll.status).toBe("open");
    expect(poll.options).toHaveLength(2);
    expect(poll.options[0].startDate).toBe("2025-07-01");
    expect(poll.participants).toHaveLength(1);
    expect(poll.participants[0].userId).toBe(owner.id);
  });

  it("creates a poll with note and deadline", async () => {
    const res = await app.request(
      "/api/polls",
      json({
        ...VALID_POLL,
        note: "Please respond by Friday",
        deadline: "2025-06-15T23:59:59.000Z",
      }),
    );

    expect(res.status).toBe(201);
    const poll = await res.json();
    expect(poll.note).toBe("Please respond by Friday");
    expect(poll.deadline).toBe("2025-06-15T23:59:59.000Z");
  });

  it("lists polls owned by user", async () => {
    await app.request("/api/polls", json(VALID_POLL));

    const res = await app.request("/api/polls");
    expect(res.status).toBe(200);
    const polls = await res.json();
    expect(polls).toHaveLength(1);
    expect(polls[0].title).toBe("Summer Trip");
    expect(polls[0].participantCount).toBe(1);
    expect(polls[0].respondedCount).toBe(0);
  });

  it("lists polls where user is a participant", async () => {
    const other = await createTestUser({ name: "Other", email: "other@test.com" });

    // Create poll as owner, add other as participant
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const poll = await createRes.json();
    await app.request(`/api/polls/${poll.id}/participants`, json({ userId: other.id }));

    // Switch to other user
    mockGetSession.mockImplementation(() => ({
      user: other,
      session: { id: "other-session" },
    }));

    const res = await app.request("/api/polls");
    expect(res.status).toBe(200);
    const polls = await res.json();
    expect(polls).toHaveLength(1);
    expect(polls[0].id).toBe(poll.id);
  });

  it("gets poll detail with options and participants", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const res = await app.request(`/api/polls/${created.id}`);
    expect(res.status).toBe(200);
    const poll = await res.json();
    expect(poll.title).toBe("Summer Trip");
    expect(poll.isOwner).toBe(true);
    expect(poll.options).toHaveLength(2);
    expect(poll.participants).toHaveLength(1);
    expect(poll.myParticipantId).toBeTruthy();
  });

  it("updates poll title and note", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const res = await app.request(
      `/api/polls/${created.id}`,
      patch({ title: "Winter Trip", note: "Updated note" }),
    );
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.title).toBe("Winter Trip");
    expect(updated.note).toBe("Updated note");
  });

  it("rejects update on non-open poll", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    // Close poll directly in DB
    const db = getTestDb();
    await db
      .update(schedulePolls)
      .set({ status: "closed" })
      .where(eq(schedulePolls.id, created.id));

    const res = await app.request(`/api/polls/${created.id}`, patch({ title: "Hacked" }));
    expect(res.status).toBe(400);
  });

  it("deletes a poll", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const res = await app.request(`/api/polls/${created.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);

    const db = getTestDb();
    const poll = await db.query.schedulePolls.findFirst({
      where: eq(schedulePolls.id, created.id),
    });
    expect(poll).toBeUndefined();
  });

  it("non-owner cannot update poll", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const other = await createTestUser({ name: "Other", email: "other@test.com" });
    mockGetSession.mockImplementation(() => ({
      user: other,
      session: { id: "other-session" },
    }));

    const res = await app.request(`/api/polls/${created.id}`, patch({ title: "Hacked" }));
    expect(res.status).toBe(404);
  });

  it("non-participant cannot view poll", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const stranger = await createTestUser({ name: "Stranger", email: "stranger@test.com" });
    mockGetSession.mockImplementation(() => ({
      user: stranger,
      session: { id: "stranger-session" },
    }));

    const res = await app.request(`/api/polls/${created.id}`);
    expect(res.status).toBe(404);
  });

  // --- Options ---

  it("adds an option to a poll", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const res = await app.request(
      `/api/polls/${created.id}/options`,
      json({ startDate: "2025-08-01", endDate: "2025-08-03" }),
    );
    expect(res.status).toBe(201);
    const option = await res.json();
    expect(option.startDate).toBe("2025-08-01");
    expect(option.sortOrder).toBe(2);
  });

  it("deletes an option from a poll", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();
    const optionId = created.options[0].id;

    const res = await app.request(`/api/polls/${created.id}/options/${optionId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const db = getTestDb();
    const options = await db.query.schedulePollOptions.findMany({
      where: eq(schedulePollOptions.pollId, created.id),
    });
    expect(options).toHaveLength(1);
  });

  // --- Participants ---

  it("adds a participant to a poll", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const other = await createTestUser({ name: "Participant", email: "participant@test.com" });
    const res = await app.request(
      `/api/polls/${created.id}/participants`,
      json({ userId: other.id }),
    );
    expect(res.status).toBe(201);
    const participant = await res.json();
    expect(participant.userId).toBe(other.id);
    expect(participant.name).toBe("Participant");
  });

  it("rejects duplicate participant", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const other = await createTestUser({ name: "Dup", email: "dup@test.com" });
    await app.request(`/api/polls/${created.id}/participants`, json({ userId: other.id }));

    const res = await app.request(
      `/api/polls/${created.id}/participants`,
      json({ userId: other.id }),
    );
    expect(res.status).toBe(409);
  });

  it("removes a participant from a poll", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const other = await createTestUser({ name: "Remove", email: "remove@test.com" });
    const addRes = await app.request(
      `/api/polls/${created.id}/participants`,
      json({ userId: other.id }),
    );
    const participant = await addRes.json();

    const res = await app.request(`/api/polls/${created.id}/participants/${participant.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);

    const db = getTestDb();
    const participants = await db.query.schedulePollParticipants.findMany({
      where: eq(schedulePollParticipants.pollId, created.id),
    });
    // Only owner remains
    expect(participants).toHaveLength(1);
  });

  // --- Responses ---

  it("submits responses for a participant", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const res = await app.request(
      `/api/polls/${created.id}/responses`,
      put({
        responses: [
          { optionId: created.options[0].id, response: "ok" },
          { optionId: created.options[1].id, response: "ng" },
        ],
      }),
    );
    expect(res.status).toBe(200);

    const db = getTestDb();
    const responses = await db.query.schedulePollResponses.findMany({
      where: eq(schedulePollResponses.participantId, created.participants[0].id),
    });
    expect(responses).toHaveLength(2);
  });

  it("replaces existing responses on resubmit", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    // First submission
    await app.request(
      `/api/polls/${created.id}/responses`,
      put({
        responses: [
          { optionId: created.options[0].id, response: "ok" },
          { optionId: created.options[1].id, response: "ng" },
        ],
      }),
    );

    // Second submission (replace)
    await app.request(
      `/api/polls/${created.id}/responses`,
      put({
        responses: [{ optionId: created.options[0].id, response: "maybe" }],
      }),
    );

    const db = getTestDb();
    const responses = await db.query.schedulePollResponses.findMany({
      where: eq(schedulePollResponses.participantId, created.participants[0].id),
    });
    expect(responses).toHaveLength(1);
    expect(responses[0].response).toBe("maybe");
  });

  it("rejects responses from non-participant", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const stranger = await createTestUser({ name: "Stranger", email: "stranger@test.com" });
    mockGetSession.mockImplementation(() => ({
      user: stranger,
      session: { id: "stranger-session" },
    }));

    const res = await app.request(
      `/api/polls/${created.id}/responses`,
      put({ responses: [{ optionId: created.options[0].id, response: "ok" }] }),
    );
    expect(res.status).toBe(404);
  });

  // --- Share ---

  it("generates a share token", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const res = await app.request(`/api/polls/${created.id}/share`, json({}));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shareToken).toBeTruthy();
    expect(data.shareToken).toHaveLength(32);
  });

  it("returns existing share token on repeated call", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const res1 = await app.request(`/api/polls/${created.id}/share`, json({}));
    const data1 = await res1.json();

    const res2 = await app.request(`/api/polls/${created.id}/share`, json({}));
    const data2 = await res2.json();

    expect(data1.shareToken).toBe(data2.shareToken);
  });

  // --- Shared poll (no auth) ---

  it("views shared poll via token", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const shareRes = await app.request(`/api/polls/${created.id}/share`, json({}));
    const { shareToken } = await shareRes.json();

    const res = await app.request(`/api/polls/shared/${shareToken}`);
    expect(res.status).toBe(200);
    const poll = await res.json();
    expect(poll.title).toBe("Summer Trip");
    expect(poll.options).toHaveLength(2);
    expect(poll.participants).toHaveLength(1);
  });

  it("returns 404 for invalid share token", async () => {
    const res = await app.request("/api/polls/shared/invalid-token");
    expect(res.status).toBe(404);
  });

  it("submits guest response via shared link", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    const shareRes = await app.request(`/api/polls/${created.id}/share`, json({}));
    const { shareToken } = await shareRes.json();

    const res = await app.request(
      `/api/polls/shared/${shareToken}/responses`,
      json({
        guestName: "Guest User",
        responses: [
          { optionId: created.options[0].id, response: "ok" },
          { optionId: created.options[1].id, response: "maybe" },
        ],
      }),
    );
    expect(res.status).toBe(200);

    const db = getTestDb();
    const participants = await db.query.schedulePollParticipants.findMany({
      where: eq(schedulePollParticipants.pollId, created.id),
    });
    // Owner + guest
    expect(participants).toHaveLength(2);
    const guest = participants.find((p) => p.guestName === "Guest User");
    expect(guest).toBeTruthy();
    expect(guest!.userId).toBeNull();
  });

  // --- Confirm ---

  it("confirms a poll and creates a trip", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    // Add another participant
    const other = await createTestUser({ name: "Member", email: "member@test.com" });
    await app.request(`/api/polls/${created.id}/participants`, json({ userId: other.id }));

    const res = await app.request(
      `/api/polls/${created.id}/confirm`,
      json({ optionId: created.options[0].id }),
    );
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.status).toBe("confirmed");
    expect(result.tripId).toBeTruthy();
    expect(result.confirmedOptionId).toBe(created.options[0].id);

    const db = getTestDb();

    // Trip was created
    const days = await db.query.tripDays.findMany({
      where: eq(tripDays.tripId, result.tripId),
    });
    // 2025-07-01 to 2025-07-03 = 3 days
    expect(days).toHaveLength(3);

    // Members were added
    const members = await db.query.tripMembers.findMany({
      where: eq(tripMembers.tripId, result.tripId),
    });
    expect(members).toHaveLength(2);
    const ownerMember = members.find((m) => m.userId === owner.id);
    expect(ownerMember!.role).toBe("owner");
    const otherMember = members.find((m) => m.userId === other.id);
    expect(otherMember!.role).toBe("editor");
  });

  it("does not add guest participants to trip on confirm", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    // Add guest via shared link
    const shareRes = await app.request(`/api/polls/${created.id}/share`, json({}));
    const { shareToken } = await shareRes.json();
    await app.request(
      `/api/polls/shared/${shareToken}/responses`,
      json({
        guestName: "Guest",
        responses: [{ optionId: created.options[0].id, response: "ok" }],
      }),
    );

    const res = await app.request(
      `/api/polls/${created.id}/confirm`,
      json({ optionId: created.options[0].id }),
    );
    expect(res.status).toBe(200);
    const result = await res.json();

    const db = getTestDb();
    const members = await db.query.tripMembers.findMany({
      where: eq(tripMembers.tripId, result.tripId),
    });
    // Only owner, not guest
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(owner.id);
  });

  it("rejects confirm on non-open poll", async () => {
    const createRes = await app.request("/api/polls", json(VALID_POLL));
    const created = await createRes.json();

    // Confirm first
    await app.request(
      `/api/polls/${created.id}/confirm`,
      json({ optionId: created.options[0].id }),
    );

    // Try to confirm again
    const res = await app.request(
      `/api/polls/${created.id}/confirm`,
      json({ optionId: created.options[1].id }),
    );
    expect(res.status).toBe(400);
  });
});

describe("Trip creation with poll mode", () => {
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

  it("creates a trip with scheduling status when pollOptions provided", async () => {
    const res = await app.request(
      "/api/trips",
      json({
        title: "Summer Trip",
        destination: "Okinawa",
        pollOptions: [
          { startDate: "2026-08-01", endDate: "2026-08-03" },
          { startDate: "2026-08-08", endDate: "2026-08-10" },
        ],
      }),
    );

    expect(res.status).toBe(201);
    const trip = await res.json();
    expect(trip.status).toBe("scheduling");
    expect(trip.startDate).toBe("2026-08-01");
    expect(trip.endDate).toBe("2026-08-03");
  });

  it("does not create trip_days when status is scheduling", async () => {
    const res = await app.request(
      "/api/trips",
      json({
        title: "No Days Trip",
        destination: "Tokyo",
        pollOptions: [{ startDate: "2026-09-01", endDate: "2026-09-02" }],
      }),
    );
    const trip = await res.json();

    const db = getTestDb();
    const days = await db.query.tripDays.findMany({
      where: eq(tripDays.tripId, trip.id),
    });
    expect(days).toHaveLength(0);
  });

  it("creates a linked poll with owner as participant", async () => {
    const res = await app.request(
      "/api/trips",
      json({
        title: "Poll Trip",
        destination: "Kyoto",
        pollOptions: [
          { startDate: "2026-10-01", endDate: "2026-10-03" },
          { startDate: "2026-10-15", endDate: "2026-10-17" },
        ],
        pollNote: "Let's decide dates!",
      }),
    );
    const trip = await res.json();

    const db = getTestDb();
    const poll = await db.query.schedulePolls.findFirst({
      where: eq(schedulePolls.tripId, trip.id),
      with: { options: true, participants: true },
    });

    expect(poll).toBeTruthy();
    expect(poll!.status).toBe("open");
    expect(poll!.title).toBe("Poll Trip");
    expect(poll!.note).toBe("Let's decide dates!");
    expect(poll!.options).toHaveLength(2);
    expect(poll!.participants).toHaveLength(1);
    expect(poll!.participants[0].userId).toBe(owner.id);
  });

  it("still creates a normal draft trip with startDate/endDate", async () => {
    const res = await app.request(
      "/api/trips",
      json({
        title: "Direct Trip",
        destination: "Nara",
        startDate: "2026-07-01",
        endDate: "2026-07-03",
      }),
    );

    expect(res.status).toBe(201);
    const trip = await res.json();
    expect(trip.status).toBe("draft");

    const db = getTestDb();
    const days = await db.query.tripDays.findMany({
      where: eq(tripDays.tripId, trip.id),
    });
    expect(days.length).toBeGreaterThan(0);
  });
});
