import {
  createTripSchema,
  createTripWithPollSchema,
  MAX_TRIPS_PER_USER,
  updateTripSchema,
} from "@sugara/shared";
import { and, count, countDistinct, desc, eq, getTableColumns, ne } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import {
  dayPatterns,
  schedulePollOptions,
  schedulePollParticipants,
  schedulePollResponses,
  schedulePolls,
  schedules,
  tripDays,
  tripMembers,
  trips,
} from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { queryCandidatesWithReactions } from "../lib/candidate-query";
import { ERROR_MSG } from "../lib/constants";
import { buildScheduleCloneValues } from "../lib/schedule-clone";
import { createInitialTripDays, generateDateRange, syncTripDays } from "../lib/trip-days";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const tripRoutes = new Hono<AppEnv>();
tripRoutes.use("*", requireAuth);

// List trips for current user, filtered by scope
tripRoutes.get("/", async (c) => {
  const user = c.get("user");
  const scope = c.req.query("scope") as string | undefined;

  const roleFilter =
    scope === "owned"
      ? eq(tripMembers.role, "owner")
      : scope === "shared"
        ? ne(tripMembers.role, "owner")
        : undefined;

  const tripColumns = getTableColumns(trips);

  const result = await db
    .select({
      ...tripColumns,
      role: tripMembers.role,
      totalSchedules: count(schedules.id),
    })
    .from(tripMembers)
    .innerJoin(trips, eq(tripMembers.tripId, trips.id))
    .leftJoin(schedules, eq(trips.id, schedules.tripId))
    .where(and(eq(tripMembers.userId, user.id), roleFilter))
    .groupBy(trips.id, tripMembers.role)
    .orderBy(desc(trips.updatedAt));

  return c.json(result);
});

// Create a trip (direct dates or poll mode)
tripRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const isPollMode = "pollOptions" in body;

  if (isPollMode) {
    const parsed = createTripWithPollSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const { title, destination = null, pollOptions } = parsed.data;

    const trip = await db.transaction(async (tx) => {
      const [tripCount] = await tx
        .select({ count: count() })
        .from(trips)
        .where(eq(trips.ownerId, user.id));
      if (tripCount.count >= MAX_TRIPS_PER_USER) {
        return null;
      }

      const [created] = await tx
        .insert(trips)
        .values({
          ownerId: user.id,
          title,
          destination,
          status: "scheduling",
        })
        .returning();

      // No trip_days for scheduling status

      await tx.insert(tripMembers).values({
        tripId: created.id,
        userId: user.id,
        role: "owner" as const,
      });

      const [poll] = await tx
        .insert(schedulePolls)
        .values({
          tripId: created.id,
          note: null,
        })
        .returning();

      await tx.insert(schedulePollOptions).values(
        pollOptions.map((opt, i) => ({
          pollId: poll.id,
          startDate: opt.startDate,
          endDate: opt.endDate,
          sortOrder: i,
        })),
      );

      await tx.insert(schedulePollParticipants).values({
        pollId: poll.id,
        userId: user.id,
      });

      return created;
    });

    if (!trip) {
      return c.json({ error: ERROR_MSG.LIMIT_TRIPS }, 409);
    }

    logActivity({
      tripId: trip.id,
      userId: user.id,
      action: "created",
      entityType: "trip",
      entityName: trip.title,
    });

    logActivity({
      tripId: trip.id,
      userId: user.id,
      action: "created",
      entityType: "poll",
    });

    return c.json(trip, 201);
  }

  // Direct date mode
  const parsed = createTripSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { title, destination = null, startDate, endDate } = parsed.data;

  const trip = await db.transaction(async (tx) => {
    const [tripCount] = await tx
      .select({ count: count() })
      .from(trips)
      .where(eq(trips.ownerId, user.id));
    if (tripCount.count >= MAX_TRIPS_PER_USER) {
      return null;
    }

    const [created] = await tx
      .insert(trips)
      .values({
        ownerId: user.id,
        title,
        destination,
        startDate,
        endDate,
      })
      .returning();

    await createInitialTripDays(tx, created.id, startDate, endDate);

    // Add owner as trip member
    await tx.insert(tripMembers).values({
      tripId: created.id,
      userId: user.id,
      role: "owner" as const,
    });

    return created;
  });

  if (!trip) {
    return c.json({ error: ERROR_MSG.LIMIT_TRIPS }, 409);
  }

  logActivity({
    tripId: trip.id,
    userId: user.id,
    action: "created",
    entityType: "trip",
    entityName: trip.title,
  });

  return c.json(trip, 201);
});

// Get trip detail with days and schedules (any member can view)
tripRoutes.get("/:id", requireTripAccess("viewer", "id"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");
  const role = c.get("tripRole");

  const [trip, candidates, [{ count: memberCount }]] = await Promise.all([
    db.query.trips.findFirst({
      where: eq(trips.id, tripId),
      with: {
        days: {
          orderBy: (days, { asc }) => [asc(days.dayNumber)],
          with: {
            patterns: {
              orderBy: (patterns, { asc }) => [asc(patterns.sortOrder)],
              with: {
                schedules: {
                  orderBy: (schedules, { asc }) => [asc(schedules.sortOrder)],
                },
              },
            },
          },
        },
      },
    }),
    queryCandidatesWithReactions(tripId, user.id),
    db.select({ count: count() }).from(tripMembers).where(eq(tripMembers.tripId, tripId)),
  ]);

  if (!trip) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  // Derive from already-fetched data instead of an extra DB query
  const scheduleCount =
    trip.days.flatMap((d) => d.patterns).flatMap((p) => p.schedules).length + candidates.length;

  // Fetch linked poll summary
  const linkedPoll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.tripId, tripId),
    columns: { id: true, status: true },
  });

  let poll: {
    id: string;
    status: string;
    participantCount: number;
    respondedCount: number;
  } | null = null;

  if (linkedPoll) {
    const [[{ count: participantCount }], [{ count: respondedCount }]] = await Promise.all([
      db
        .select({ count: count() })
        .from(schedulePollParticipants)
        .where(eq(schedulePollParticipants.pollId, linkedPoll.id)),
      db
        .select({ count: countDistinct(schedulePollResponses.participantId) })
        .from(schedulePollResponses)
        .innerJoin(schedulePollOptions, eq(schedulePollResponses.optionId, schedulePollOptions.id))
        .where(eq(schedulePollOptions.pollId, linkedPoll.id)),
    ]);

    poll = {
      id: linkedPoll.id,
      status: linkedPoll.status,
      participantCount,
      respondedCount,
    };
  }

  return c.json({
    ...trip,
    role,
    candidates,
    scheduleCount,
    memberCount,
    poll,
  });
});

// Update trip (owner or editor)
tripRoutes.patch("/:id", requireTripAccess("editor", "id"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTripSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { startDate: newStart, endDate: newEnd, ...otherFields } = parsed.data;

  const currentTrip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });
  if (!currentTrip) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const effectiveStart = newStart ?? currentTrip.startDate;
  const effectiveEnd = newEnd ?? currentTrip.endDate;
  const datesChanged =
    effectiveStart !== currentTrip.startDate || effectiveEnd !== currentTrip.endDate;

  if (datesChanged) {
    // Validate cross-field constraint when only one date is sent
    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      return c.json(
        {
          error: {
            fieldErrors: { endDate: [ERROR_MSG.DATE_ORDER] },
            formErrors: [],
          },
        },
        400,
      );
    }

    // Reject date changes that reduce the number of days
    if (effectiveStart && effectiveEnd && currentTrip.startDate && currentTrip.endDate) {
      const currentDayCount = generateDateRange(currentTrip.startDate, currentTrip.endDate).length;
      const newDayCount = generateDateRange(effectiveStart, effectiveEnd).length;
      if (newDayCount < currentDayCount) {
        return c.json({ error: ERROR_MSG.TRIP_DAYS_REDUCED }, 400);
      }
    }
  }

  // Build update payload with only changed fields
  const updatePayload: Record<string, unknown> = {};
  if (otherFields.title !== undefined && otherFields.title !== currentTrip.title) {
    updatePayload.title = otherFields.title;
  }
  if (
    otherFields.destination !== undefined &&
    otherFields.destination !== currentTrip.destination
  ) {
    updatePayload.destination = otherFields.destination;
  }
  if (otherFields.status !== undefined && otherFields.status !== currentTrip.status) {
    updatePayload.status = otherFields.status;
  }
  if (datesChanged) {
    if (effectiveStart !== currentTrip.startDate) updatePayload.startDate = effectiveStart;
    if (effectiveEnd !== currentTrip.endDate) updatePayload.endDate = effectiveEnd;
  }

  if (Object.keys(updatePayload).length === 0) {
    return c.json(currentTrip);
  }

  let updated: typeof currentTrip | undefined;

  if (datesChanged && effectiveStart && effectiveEnd) {
    updated = await db.transaction(async (tx) => {
      await syncTripDays(tx, tripId, effectiveStart, effectiveEnd);
      const [result] = await tx
        .update(trips)
        .set({ ...updatePayload, updatedAt: new Date() })
        .where(eq(trips.id, tripId))
        .returning();
      return result;
    });
  } else {
    const [result] = await db
      .update(trips)
      .set({ ...updatePayload, updatedAt: new Date() })
      .where(eq(trips.id, tripId))
      .returning();
    updated = result;
  }

  if (!updated) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  logActivity({
    tripId,
    userId: user.id,
    action: "updated",
    entityType: "trip",
    entityName: updated.title,
    detail: updatePayload.status ? `status: ${updatePayload.status}` : undefined,
  });

  return c.json(updated);
});

// Duplicate trip (any member can duplicate, new trip is owned by current user)
tripRoutes.post("/:id/duplicate", requireTripAccess("viewer", "id"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const source = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
    with: {
      days: {
        orderBy: (days, { asc }) => [asc(days.dayNumber)],
        with: {
          patterns: {
            orderBy: (patterns, { asc }) => [asc(patterns.sortOrder)],
            with: {
              schedules: {
                orderBy: (schedules, { asc }) => [asc(schedules.sortOrder)],
              },
            },
          },
        },
      },
    },
  });
  if (!source) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const newTrip = await db.transaction(async (tx) => {
    const [tripCount] = await tx
      .select({ count: count() })
      .from(trips)
      .where(eq(trips.ownerId, user.id));
    if (tripCount.count >= MAX_TRIPS_PER_USER) {
      return null;
    }

    const [created] = await tx
      .insert(trips)
      .values({
        ownerId: user.id,
        title: `${source.title} (copy)`,
        destination: source.destination,
        startDate: source.startDate,
        endDate: source.endDate,
        status: source.status === "scheduling" ? "scheduling" : "draft",
      })
      .returning();

    if (source.status === "scheduling") {
      const sourcePoll = await tx.query.schedulePolls.findFirst({
        where: eq(schedulePolls.tripId, source.id),
        with: {
          options: { orderBy: (o, { asc }) => [asc(o.sortOrder)] },
          participants: true,
        },
      });

      if (!sourcePoll) {
        console.warn(`Scheduling trip ${source.id} has no poll, skipping poll copy`);
      } else {
        const [newPoll] = await tx
          .insert(schedulePolls)
          .values({
            tripId: created.id,
            note: sourcePoll.note,
            deadline: sourcePoll.deadline,
          })
          .returning();

        if (sourcePoll.options.length > 0) {
          await tx.insert(schedulePollOptions).values(
            sourcePoll.options.map((opt) => ({
              pollId: newPoll.id,
              startDate: opt.startDate,
              endDate: opt.endDate,
              sortOrder: opt.sortOrder,
            })),
          );
        }

        if (sourcePoll.participants.length > 0) {
          await tx.insert(schedulePollParticipants).values(
            sourcePoll.participants.map((p) => ({
              pollId: newPoll.id,
              userId: p.userId,
            })),
          );
        }
      }
    } else {
      for (const day of source.days) {
        const [newDay] = await tx
          .insert(tripDays)
          .values({
            tripId: created.id,
            date: day.date,
            dayNumber: day.dayNumber,
          })
          .returning({ id: tripDays.id });

        for (const pattern of day.patterns) {
          const [newPattern] = await tx
            .insert(dayPatterns)
            .values({
              tripDayId: newDay.id,
              label: pattern.label,
              isDefault: pattern.isDefault,
              sortOrder: pattern.sortOrder,
            })
            .returning({ id: dayPatterns.id });

          if (pattern.schedules.length > 0) {
            await tx.insert(schedules).values(
              pattern.schedules.map((schedule) => ({
                tripId: created.id,
                dayPatternId: newPattern.id,
                ...buildScheduleCloneValues(schedule),
              })),
            );
          }
        }
      }
    }

    await tx.insert(tripMembers).values({
      tripId: created.id,
      userId: user.id,
      role: "owner" as const,
    });

    return created;
  });

  if (!newTrip) {
    return c.json({ error: ERROR_MSG.LIMIT_TRIPS }, 409);
  }

  logActivity({
    tripId: newTrip.id,
    userId: user.id,
    action: "duplicated",
    entityType: "trip",
    entityName: newTrip.title,
  });

  return c.json(newTrip, 201);
});

// Delete trip (owner only)
tripRoutes.delete("/:id", requireTripAccess("owner", "id"), async (c) => {
  const tripId = c.req.param("id");

  // Log before delete since cascade will remove logs too
  await db.delete(trips).where(eq(trips.id, tripId));
  return c.json({ ok: true });
});

export { tripRoutes };
