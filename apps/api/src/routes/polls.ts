import {
  addPollOptionSchema,
  addPollParticipantSchema,
  confirmPollSchema,
  createPollSchema,
  MAX_OPTIONS_PER_POLL,
  MAX_PARTICIPANTS_PER_POLL,
  MAX_POLLS_PER_USER,
  submitPollResponsesSchema,
  updatePollSchema,
} from "@sugara/shared";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import {
  schedulePollOptions,
  schedulePollParticipants,
  schedulePollResponses,
  schedulePolls,
  tripMembers,
  trips,
  users,
} from "../db/schema";
import { formatShortDateRange, logActivity } from "../lib/activity-logger";
import { ERROR_MSG } from "../lib/constants";
import { findPollAsEditor, findPollAsOwner, findPollAsParticipant } from "../lib/poll-access";
import { createInitialTripDays } from "../lib/trip-days";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const pollRoutes = new Hono<AppEnv>();
pollRoutes.use("*", requireAuth);

// List polls (owned or participant)
pollRoutes.get("/", async (c) => {
  const user = c.get("user");

  const ownedPolls = await db
    .select({
      id: schedulePolls.id,
      title: schedulePolls.title,
      destination: schedulePolls.destination,
      status: schedulePolls.status,
      deadline: schedulePolls.deadline,
      createdAt: schedulePolls.createdAt,
      updatedAt: schedulePolls.updatedAt,
    })
    .from(schedulePolls)
    .where(eq(schedulePolls.ownerId, user.id))
    .orderBy(desc(schedulePolls.updatedAt));

  const participatingPolls = await db
    .select({
      id: schedulePolls.id,
      title: schedulePolls.title,
      destination: schedulePolls.destination,
      status: schedulePolls.status,
      deadline: schedulePolls.deadline,
      createdAt: schedulePolls.createdAt,
      updatedAt: schedulePolls.updatedAt,
    })
    .from(schedulePollParticipants)
    .innerJoin(schedulePolls, eq(schedulePollParticipants.pollId, schedulePolls.id))
    .where(
      and(
        eq(schedulePollParticipants.userId, user.id),
        sql`${schedulePolls.ownerId} != ${user.id}`,
      ),
    )
    .orderBy(desc(schedulePolls.updatedAt));

  const allPollIds = [...ownedPolls.map((p) => p.id), ...participatingPolls.map((p) => p.id)];

  if (allPollIds.length === 0) return c.json([]);

  const participantCounts = await db
    .select({
      pollId: schedulePollParticipants.pollId,
      count: count(),
    })
    .from(schedulePollParticipants)
    .where(inArray(schedulePollParticipants.pollId, allPollIds))
    .groupBy(schedulePollParticipants.pollId);

  const respondedCounts = await db
    .select({
      pollId: schedulePollParticipants.pollId,
      count: count(sql`DISTINCT ${schedulePollResponses.participantId}`),
    })
    .from(schedulePollParticipants)
    .innerJoin(
      schedulePollResponses,
      eq(schedulePollParticipants.id, schedulePollResponses.participantId),
    )
    .where(inArray(schedulePollParticipants.pollId, allPollIds))
    .groupBy(schedulePollParticipants.pollId);

  const participantMap = new Map(participantCounts.map((r) => [r.pollId, r.count]));
  const respondedMap = new Map(respondedCounts.map((r) => [r.pollId, r.count]));

  const allPolls = [...ownedPolls, ...participatingPolls].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return c.json(
    allPolls.map((p) => ({
      ...p,
      deadline: p.deadline?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      participantCount: participantMap.get(p.id) ?? 0,
      respondedCount: respondedMap.get(p.id) ?? 0,
    })),
  );
});

// Create poll
pollRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createPollSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { title, destination = null, note, deadline, options } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [pollCount] = await tx
      .select({ count: count() })
      .from(schedulePolls)
      .where(eq(schedulePolls.ownerId, user.id));
    if (pollCount.count >= MAX_POLLS_PER_USER) {
      return null;
    }

    const [poll] = await tx
      .insert(schedulePolls)
      .values({
        ownerId: user.id,
        title,
        destination,
        note: note ?? null,
        deadline: deadline ? new Date(deadline) : null,
      })
      .returning();

    const insertedOptions = await tx
      .insert(schedulePollOptions)
      .values(
        options.map((opt, i) => ({
          pollId: poll.id,
          startDate: opt.startDate,
          endDate: opt.endDate,
          sortOrder: i,
        })),
      )
      .returning();

    // Auto-add owner as participant
    const [ownerParticipant] = await tx
      .insert(schedulePollParticipants)
      .values({ pollId: poll.id, userId: user.id })
      .returning();

    return { poll, options: insertedOptions, ownerParticipant };
  });

  if (!result) {
    return c.json({ error: ERROR_MSG.LIMIT_POLLS }, 409);
  }

  return c.json(
    {
      ...result.poll,
      deadline: result.poll.deadline?.toISOString() ?? null,
      createdAt: result.poll.createdAt.toISOString(),
      updatedAt: result.poll.updatedAt.toISOString(),
      options: result.options.map((o) => ({
        id: o.id,
        startDate: o.startDate,
        endDate: o.endDate,
        sortOrder: o.sortOrder,
      })),
      participants: [
        {
          id: result.ownerParticipant.id,
          userId: user.id,
          name: user.name,
          image: null,
          responses: [],
        },
      ],
    },
    201,
  );
});

// Get poll detail
pollRoutes.get("/:pollId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");

  const poll = await findPollAsParticipant(pollId, user.id);
  if (!poll) {
    return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  }

  const [options, participants] = await Promise.all([
    db.query.schedulePollOptions.findMany({
      where: eq(schedulePollOptions.pollId, pollId),
      orderBy: (o, { asc }) => [asc(o.sortOrder)],
    }),
    db.query.schedulePollParticipants.findMany({
      where: eq(schedulePollParticipants.pollId, pollId),
      with: {
        user: { columns: { id: true, name: true, image: true } },
        responses: true,
      },
    }),
  ]);

  const myParticipant = participants.find((p) => p.userId === user.id);

  return c.json({
    id: poll.id,
    ownerId: poll.ownerId,
    title: poll.title,
    destination: poll.destination,
    note: poll.note,
    status: poll.status,
    deadline: poll.deadline?.toISOString() ?? null,
    confirmedOptionId: poll.confirmedOptionId,
    tripId: poll.tripId,
    options: options.map((o) => ({
      id: o.id,
      startDate: o.startDate,
      endDate: o.endDate,
      sortOrder: o.sortOrder,
    })),
    participants: participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user!.name,
      image: p.user!.image,
      responses: p.responses.map((r) => ({
        optionId: r.optionId,
        response: r.response,
      })),
    })),
    isOwner: poll.ownerId === user.id,
    myParticipantId: myParticipant?.id ?? null,
    createdAt: poll.createdAt.toISOString(),
    updatedAt: poll.updatedAt.toISOString(),
  });
});

// Update poll (owner: all fields, editor: note only, open only)
pollRoutes.patch("/:pollId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const parsed = updatePollSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const result = await findPollAsEditor(pollId, user.id);
  if (!result) {
    return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  }
  if (result.poll.status !== "open") {
    return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.note !== undefined) updates.note = parsed.data.note;
  // Owner-only fields
  if (result.isOwner) {
    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.destination !== undefined) updates.destination = parsed.data.destination;
    if (parsed.data.deadline !== undefined) {
      updates.deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;
    }
  }

  const [updated] = await db
    .update(schedulePolls)
    .set(updates)
    .where(eq(schedulePolls.id, pollId))
    .returning();

  return c.json({
    id: updated.id,
    ownerId: updated.ownerId,
    title: updated.title,
    destination: updated.destination,
    note: updated.note,
    status: updated.status,
    deadline: updated.deadline?.toISOString() ?? null,
    confirmedOptionId: updated.confirmedOptionId,
    tripId: updated.tripId,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

// Delete poll (owner only)
pollRoutes.delete("/:pollId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) {
    return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  }

  await db.transaction(async (tx) => {
    // Cascade delete trip if it's still in scheduling status
    if (poll.tripId) {
      const trip = await tx.query.trips.findFirst({
        where: eq(trips.id, poll.tripId),
        columns: { id: true, status: true },
      });
      if (trip?.status === "scheduling") {
        await tx.delete(trips).where(eq(trips.id, trip.id));
      }
    }
    await tx.delete(schedulePolls).where(eq(schedulePolls.id, pollId));
  });

  return c.json({ ok: true });
});

// Add option (owner only, open only)
pollRoutes.post("/:pollId/options", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const parsed = addPollOptionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);

  const [optionCount] = await db
    .select({ count: count() })
    .from(schedulePollOptions)
    .where(eq(schedulePollOptions.pollId, pollId));
  if (optionCount.count >= MAX_OPTIONS_PER_POLL) {
    return c.json({ error: ERROR_MSG.LIMIT_POLL_OPTIONS }, 409);
  }

  const [option] = await db
    .insert(schedulePollOptions)
    .values({
      pollId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      sortOrder: optionCount.count,
    })
    .returning();

  await db.update(schedulePolls).set({ updatedAt: new Date() }).where(eq(schedulePolls.id, pollId));

  if (poll.tripId) {
    logActivity({
      tripId: poll.tripId,
      userId: user.id,
      action: "option_added",
      entityType: "poll",
      entityName: formatShortDateRange(option.startDate, option.endDate),
    });
  }

  return c.json(
    {
      id: option.id,
      startDate: option.startDate,
      endDate: option.endDate,
      sortOrder: option.sortOrder,
    },
    201,
  );
});

// Delete option (owner only, open only)
pollRoutes.delete("/:pollId/options/:optionId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const optionId = c.req.param("optionId");

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);

  const deleted = await db
    .delete(schedulePollOptions)
    .where(and(eq(schedulePollOptions.id, optionId), eq(schedulePollOptions.pollId, pollId)))
    .returning();
  if (deleted.length === 0) return c.json({ error: ERROR_MSG.POLL_OPTION_NOT_FOUND }, 404);

  await db.update(schedulePolls).set({ updatedAt: new Date() }).where(eq(schedulePolls.id, pollId));

  if (poll.tripId) {
    logActivity({
      tripId: poll.tripId,
      userId: user.id,
      action: "option_deleted",
      entityType: "poll",
      entityName: formatShortDateRange(deleted[0].startDate, deleted[0].endDate),
    });
  }

  return c.json({ ok: true });
});

// Add participant (owner only)
pollRoutes.post("/:pollId/participants", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const parsed = addPollParticipantSchema.safeParse(body);

  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);

  const [participantCount] = await db
    .select({ count: count() })
    .from(schedulePollParticipants)
    .where(eq(schedulePollParticipants.pollId, pollId));
  if (participantCount.count >= MAX_PARTICIPANTS_PER_POLL) {
    return c.json({ error: ERROR_MSG.LIMIT_POLL_PARTICIPANTS }, 409);
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, parsed.data.userId),
    columns: { id: true, name: true, image: true },
  });
  if (!targetUser) return c.json({ error: ERROR_MSG.USER_NOT_FOUND }, 404);

  const existing = await db.query.schedulePollParticipants.findFirst({
    where: and(
      eq(schedulePollParticipants.pollId, pollId),
      eq(schedulePollParticipants.userId, parsed.data.userId),
    ),
  });
  if (existing) return c.json({ error: ERROR_MSG.POLL_ALREADY_PARTICIPANT }, 409);

  const [participant] = await db
    .insert(schedulePollParticipants)
    .values({ pollId, userId: parsed.data.userId })
    .returning();

  await db.update(schedulePolls).set({ updatedAt: new Date() }).where(eq(schedulePolls.id, pollId));

  return c.json(
    {
      id: participant.id,
      userId: targetUser.id,
      name: targetUser.name,
      image: targetUser.image,
      responses: [],
    },
    201,
  );
});

// Delete participant (owner only)
pollRoutes.delete("/:pollId/participants/:participantId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const participantId = c.req.param("participantId");

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);

  const target = await db.query.schedulePollParticipants.findFirst({
    where: and(
      eq(schedulePollParticipants.id, participantId),
      eq(schedulePollParticipants.pollId, pollId),
    ),
  });
  if (!target) return c.json({ error: ERROR_MSG.POLL_PARTICIPANT_NOT_FOUND }, 404);
  if (target.userId === user.id) {
    return c.json({ error: ERROR_MSG.POLL_CANNOT_REMOVE_OWNER }, 400);
  }

  await db.delete(schedulePollParticipants).where(eq(schedulePollParticipants.id, participantId));

  await db.update(schedulePolls).set({ updatedAt: new Date() }).where(eq(schedulePolls.id, pollId));

  return c.json({ ok: true });
});

// Submit responses (participant only)
pollRoutes.put("/:pollId/responses", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const parsed = submitPollResponsesSchema.safeParse(body);

  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const poll = await findPollAsParticipant(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);
  if (poll.deadline && poll.deadline < new Date()) {
    return c.json({ error: ERROR_MSG.POLL_DEADLINE_PASSED }, 400);
  }

  const participant = await db.query.schedulePollParticipants.findFirst({
    where: and(
      eq(schedulePollParticipants.pollId, pollId),
      eq(schedulePollParticipants.userId, user.id),
    ),
  });
  if (!participant) return c.json({ error: ERROR_MSG.POLL_PARTICIPANT_NOT_FOUND }, 404);

  // Validate all optionIds belong to this poll
  if (parsed.data.responses.length > 0) {
    const validOptionIds = await db.query.schedulePollOptions.findMany({
      where: eq(schedulePollOptions.pollId, pollId),
      columns: { id: true },
    });
    const validIds = new Set(validOptionIds.map((o) => o.id));
    const invalid = parsed.data.responses.some((r) => !validIds.has(r.optionId));
    if (invalid) return c.json({ error: ERROR_MSG.POLL_INVALID_OPTION }, 400);
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(schedulePollResponses)
      .where(eq(schedulePollResponses.participantId, participant.id));

    if (parsed.data.responses.length > 0) {
      await tx.insert(schedulePollResponses).values(
        parsed.data.responses.map((r) => ({
          participantId: participant.id,
          optionId: r.optionId,
          response: r.response,
        })),
      );
    }
  });

  await db.update(schedulePolls).set({ updatedAt: new Date() }).where(eq(schedulePolls.id, pollId));

  return c.json({ ok: true });
});

const SHARE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateShareToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function shareExpiresAt() {
  return new Date(Date.now() + SHARE_LINK_TTL_MS);
}

// Generate or get share link (owner only)
pollRoutes.post("/:pollId/share", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);

  const isExpired =
    poll.shareToken && (!poll.shareTokenExpiresAt || poll.shareTokenExpiresAt < new Date());

  if (poll.shareToken && !isExpired) {
    return c.json({
      shareToken: poll.shareToken,
      shareTokenExpiresAt: poll.shareTokenExpiresAt!.toISOString(),
    });
  }

  // Generate new token (or replace expired / legacy one)
  const expiresAt = shareExpiresAt();
  const whereCondition = isExpired
    ? eq(schedulePolls.id, pollId)
    : and(eq(schedulePolls.id, pollId), isNull(schedulePolls.shareToken));
  const [updated] = await db
    .update(schedulePolls)
    .set({
      shareToken: generateShareToken(),
      shareTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(whereCondition)
    .returning({
      shareToken: schedulePolls.shareToken,
      shareTokenExpiresAt: schedulePolls.shareTokenExpiresAt,
    });

  if (!updated) {
    const refreshed = await db.query.schedulePolls.findFirst({
      where: eq(schedulePolls.id, pollId),
      columns: { shareToken: true, shareTokenExpiresAt: true },
    });
    if (!refreshed?.shareToken) {
      return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
    }
    return c.json({
      shareToken: refreshed.shareToken,
      shareTokenExpiresAt: refreshed.shareTokenExpiresAt?.toISOString() ?? null,
    });
  }

  return c.json({
    shareToken: updated.shareToken,
    shareTokenExpiresAt: updated.shareTokenExpiresAt?.toISOString() ?? null,
  });
});

// Regenerate share link (owner only)
pollRoutes.put("/:pollId/share", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);

  const expiresAt = shareExpiresAt();
  const [updated] = await db
    .update(schedulePolls)
    .set({
      shareToken: generateShareToken(),
      shareTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(schedulePolls.id, pollId))
    .returning({
      shareToken: schedulePolls.shareToken,
      shareTokenExpiresAt: schedulePolls.shareTokenExpiresAt,
    });

  if (!updated) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);

  return c.json({
    shareToken: updated.shareToken,
    shareTokenExpiresAt: updated.shareTokenExpiresAt?.toISOString() ?? null,
  });
});

// Confirm poll and create trip (owner only)
pollRoutes.post("/:pollId/confirm", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const parsed = confirmPollSchema.safeParse(body);

  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);

  const option = await db.query.schedulePollOptions.findFirst({
    where: and(
      eq(schedulePollOptions.id, parsed.data.optionId),
      eq(schedulePollOptions.pollId, pollId),
    ),
  });
  if (!option) return c.json({ error: ERROR_MSG.POLL_OPTION_NOT_FOUND }, 404);

  const result = await db.transaction(async (tx) => {
    let tripId = poll.tripId;

    if (tripId) {
      // Trip already exists (created with poll mode) - update it
      await tx
        .update(trips)
        .set({
          startDate: option.startDate,
          endDate: option.endDate,
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(trips.id, tripId));

      await createInitialTripDays(tx, tripId, option.startDate, option.endDate);

      // Add poll participants who aren't already trip members
      const participants = await tx.query.schedulePollParticipants.findMany({
        where: eq(schedulePollParticipants.pollId, pollId),
      });
      const existingMembers = await tx.query.tripMembers.findMany({
        where: eq(tripMembers.tripId, tripId),
      });
      const existingUserIds = new Set(existingMembers.map((m) => m.userId));

      const newMembers = participants.filter((p) => !existingUserIds.has(p.userId));
      if (newMembers.length > 0) {
        await tx.insert(tripMembers).values(
          newMembers.map((p) => ({
            tripId: tripId!,
            userId: p.userId,
            role: "editor" as const,
          })),
        );
      }
    } else {
      // Legacy: standalone poll (no linked trip) - create trip
      const [trip] = await tx
        .insert(trips)
        .values({
          ownerId: user.id,
          title: poll.title,
          destination: poll.destination,
          startDate: option.startDate,
          endDate: option.endDate,
        })
        .returning();

      tripId = trip.id;
      await createInitialTripDays(tx, trip.id, option.startDate, option.endDate);

      const participants = await tx.query.schedulePollParticipants.findMany({
        where: eq(schedulePollParticipants.pollId, pollId),
      });
      if (participants.length > 0) {
        await tx
          .insert(tripMembers)
          .values(
            participants.map((p) => ({
              tripId: trip.id,
              userId: p.userId,
              role: p.userId === user.id ? ("owner" as const) : ("editor" as const),
            })),
          )
          .onConflictDoNothing();
      }
    }

    const [updatedPoll] = await tx
      .update(schedulePolls)
      .set({
        status: "confirmed",
        confirmedOptionId: option.id,
        tripId,
        updatedAt: new Date(),
      })
      .where(eq(schedulePolls.id, pollId))
      .returning();

    return updatedPoll;
  });

  if (result.tripId) {
    logActivity({
      tripId: result.tripId,
      userId: user.id,
      action: "confirmed",
      entityType: "poll",
      entityName: formatShortDateRange(option.startDate, option.endDate),
    });
  }

  return c.json({
    id: result.id,
    ownerId: result.ownerId,
    title: result.title,
    destination: result.destination,
    note: result.note,
    status: result.status,
    deadline: result.deadline?.toISOString() ?? null,
    confirmedOptionId: result.confirmedOptionId,
    tripId: result.tripId,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  });
});

export { pollRoutes };
