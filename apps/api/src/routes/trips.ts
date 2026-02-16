import { createTripSchema, MAX_TRIPS_PER_USER, updateTripSchema } from "@sugara/shared";
import { and, count, desc, eq, getTableColumns, ne } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { dayPatterns, schedules, tripDays, tripMembers, trips } from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { queryCandidatesWithReactions } from "../lib/candidate-query";
import { ERROR_MSG } from "../lib/constants";
import { buildScheduleCloneValues } from "../lib/schedule-clone";
import { createInitialTripDays, syncTripDays } from "../lib/trip-days";
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

// Create a trip
tripRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createTripSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [tripCount] = await db
    .select({ count: count() })
    .from(trips)
    .where(eq(trips.ownerId, user.id));
  if (tripCount.count >= MAX_TRIPS_PER_USER) {
    return c.json({ error: ERROR_MSG.LIMIT_TRIPS }, 409);
  }

  const { title, destination, startDate, endDate } = parsed.data;

  const trip = await db.transaction(async (tx) => {
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

  const trip = await db.query.trips.findFirst({
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

  if (!trip) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const candidates = await queryCandidatesWithReactions(tripId, user.id);

  const [scheduleCount] = await db
    .select({ count: count() })
    .from(schedules)
    .where(eq(schedules.tripId, tripId));

  const [memberCount] = await db
    .select({ count: count() })
    .from(tripMembers)
    .where(eq(tripMembers.tripId, tripId));

  return c.json({
    ...trip,
    role,
    candidates,
    scheduleCount: scheduleCount.count,
    memberCount: memberCount.count,
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
  const hasDates = newStart !== undefined || newEnd !== undefined;

  if (!hasDates) {
    const [updated] = await db
      .update(trips)
      .set({ ...otherFields, updatedAt: new Date() })
      .where(eq(trips.id, tripId))
      .returning();

    if (!updated) {
      return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
    }

    logActivity({
      tripId,
      userId: user.id,
      action: "updated",
      entityType: "trip",
      entityName: updated.title,
      detail: parsed.data.status ? `status: ${parsed.data.status}` : undefined,
    });

    return c.json(updated);
  }

  // Fetch current trip to determine full date range
  const currentTrip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });
  if (!currentTrip) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const effectiveStart = newStart ?? currentTrip.startDate;
  const effectiveEnd = newEnd ?? currentTrip.endDate;

  // Validate cross-field constraint when only one date is sent
  if (effectiveEnd < effectiveStart) {
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

  const updated = await db.transaction(async (tx) => {
    await syncTripDays(tx, tripId, effectiveStart, effectiveEnd);

    const [result] = await tx
      .update(trips)
      .set({
        ...otherFields,
        startDate: effectiveStart,
        endDate: effectiveEnd,
        updatedAt: new Date(),
      })
      .where(eq(trips.id, tripId))
      .returning();

    return result;
  });

  if (!updated) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  logActivity({
    tripId,
    userId: user.id,
    action: "updated",
    entityType: "trip",
    entityName: updated.title,
  });

  return c.json(updated);
});

// Duplicate trip (any member can duplicate, new trip is owned by current user)
tripRoutes.post("/:id/duplicate", requireTripAccess("viewer", "id"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const [tripCount] = await db
    .select({ count: count() })
    .from(trips)
    .where(eq(trips.ownerId, user.id));
  if (tripCount.count >= MAX_TRIPS_PER_USER) {
    return c.json({ error: ERROR_MSG.LIMIT_TRIPS }, 409);
  }

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
    const [created] = await tx
      .insert(trips)
      .values({
        ownerId: user.id,
        title: `${source.title} (copy)`,
        destination: source.destination,
        startDate: source.startDate,
        endDate: source.endDate,
        status: "draft",
      })
      .returning();

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

    await tx.insert(tripMembers).values({
      tripId: created.id,
      userId: user.id,
      role: "owner" as const,
    });

    return created;
  });

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
