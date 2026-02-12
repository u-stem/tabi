import { createTripSchema, MAX_TRIPS_PER_USER, updateTripSchema } from "@sugara/shared";
import { and, asc, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { dayPatterns, schedules, tripDays, tripMembers, trips } from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { DEFAULT_PATTERN_LABEL, ERROR_MSG, MAX_TRIP_DAYS } from "../lib/constants";
import { canEdit, checkTripAccess, isOwner } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

function generateDateRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dates: string[] = [];
  for (
    let d = new Date(start);
    d <= end && dates.length < MAX_TRIP_DAYS;
    d.setDate(d.getDate() + 1)
  ) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${dayOfMonth}`);
  }
  return dates;
}

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

  const memberships = await db.query.tripMembers.findMany({
    where: and(eq(tripMembers.userId, user.id), roleFilter),
    with: { trip: true },
  });

  if (memberships.length === 0) return c.json([]);

  const tripIds = memberships.map((m) => m.trip.id);

  const scheduleCounts = await db
    .select({
      tripId: schedules.tripId,
      count: count(),
    })
    .from(schedules)
    .where(inArray(schedules.tripId, tripIds))
    .groupBy(schedules.tripId);

  const countMap = new Map(scheduleCounts.map((r) => [r.tripId, r.count]));

  const result = memberships.map(({ role, trip }) => ({
    ...trip,
    role,
    totalSchedules: countMap.get(trip.id) ?? 0,
  }));

  // Sort by updatedAt descending
  result.sort((a, b) => {
    const dateA = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
    const dateB = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
    return dateB - dateA;
  });

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

    // Auto-create trip days based on date range
    const dates = generateDateRange(startDate, endDate);
    if (dates.length > 0) {
      const insertedDays = await tx
        .insert(tripDays)
        .values(
          dates.map((date, i) => ({
            tripId: created.id,
            date,
            dayNumber: i + 1,
          })),
        )
        .returning({ id: tripDays.id });

      // Create default pattern for each day
      await tx.insert(dayPatterns).values(
        insertedDays.map((day) => ({
          tripDayId: day.id,
          label: DEFAULT_PATTERN_LABEL,
          isDefault: true,
          sortOrder: 0,
        })),
      );
    }

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
  }).catch(console.error);

  return c.json(trip, 201);
});

// Get trip detail with days and schedules (any member can view)
tripRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const role = await checkTripAccess(tripId, user.id);
  if (!role) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

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

  const candidates = await db.query.schedules.findMany({
    where: and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)),
    orderBy: (s, { asc }) => [asc(s.sortOrder)],
  });

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
tripRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTripSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const role = await checkTripAccess(tripId, user.id);
  if (!canEdit(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
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
    }).catch(console.error);

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
    // Generate new date set
    const newDates = generateDateRange(effectiveStart, effectiveEnd);

    // Get existing trip_days
    const existingDays = await tx
      .select()
      .from(tripDays)
      .where(eq(tripDays.tripId, tripId))
      .orderBy(asc(tripDays.date));

    const existingDateSet = new Set(existingDays.map((d) => d.date));
    const newDateSet = new Set(newDates);

    // Delete days outside new range
    const idsToDelete = existingDays.filter((d) => !newDateSet.has(d.date)).map((d) => d.id);
    if (idsToDelete.length > 0) {
      await tx.delete(tripDays).where(inArray(tripDays.id, idsToDelete));
    }

    // Insert new days
    const datesToInsert = newDates.filter((d) => !existingDateSet.has(d));
    if (datesToInsert.length > 0) {
      const newDays = await tx
        .insert(tripDays)
        .values(
          datesToInsert.map((date) => ({
            tripId,
            date,
            dayNumber: 0, // Will be corrected below
          })),
        )
        .returning({ id: tripDays.id });

      // Create default pattern for each new day
      await tx.insert(dayPatterns).values(
        newDays.map((day) => ({
          tripDayId: day.id,
          label: DEFAULT_PATTERN_LABEL,
          isDefault: true,
          sortOrder: 0,
        })),
      );
    }

    // Re-fetch all days and update dayNumber
    const allDays = await tx
      .select()
      .from(tripDays)
      .where(eq(tripDays.tripId, tripId))
      .orderBy(asc(tripDays.date));

    for (let i = 0; i < allDays.length; i++) {
      if (allDays[i].dayNumber !== i + 1) {
        await tx
          .update(tripDays)
          .set({ dayNumber: i + 1 })
          .where(eq(tripDays.id, allDays[i].id));
      }
    }

    // Update trip
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
  }).catch(console.error);

  return c.json(updated);
});

// Duplicate trip (any member can duplicate, new trip is owned by current user)
tripRoutes.post("/:id/duplicate", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const role = await checkTripAccess(tripId, user.id);
  if (!role) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

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
              name: schedule.name,
              category: schedule.category,
              address: schedule.address,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              sortOrder: schedule.sortOrder,
              memo: schedule.memo,
              url: schedule.url,
              departurePlace: schedule.departurePlace,
              arrivalPlace: schedule.arrivalPlace,
              transportMethod: schedule.transportMethod,
              color: schedule.color,
              endDayOffset: schedule.endDayOffset,
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
  }).catch(console.error);

  return c.json(newTrip, 201);
});

// Delete trip (owner only)
tripRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const role = await checkTripAccess(tripId, user.id);
  if (!isOwner(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  // Log before delete since cascade will remove logs too
  await db.delete(trips).where(eq(trips.id, tripId));
  return c.json({ ok: true });
});

export { tripRoutes };
