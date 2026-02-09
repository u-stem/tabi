import { createTripSchema, updateTripSchema } from "@tabi/shared";
import { asc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { tripDays, tripMembers, trips } from "../db/schema";
import { canEdit, checkTripAccess, isOwner } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

function generateDateRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dates: string[] = [];
  const maxDays = 365;
  for (let d = new Date(start); d <= end && dates.length < maxDays; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${dayOfMonth}`);
  }
  return dates;
}

const tripRoutes = new Hono<AppEnv>();
tripRoutes.use("*", requireAuth);

// List trips for current user (all trips where user is a member)
tripRoutes.get("/", async (c) => {
  const user = c.get("user");
  const memberships = await db.query.tripMembers.findMany({
    where: eq(tripMembers.userId, user.id),
    with: {
      trip: {
        with: {
          days: {
            with: { spots: { columns: { id: true } } },
          },
        },
      },
    },
  });

  const result = memberships.map(({ trip }) => {
    const { days, ...rest } = trip;
    return {
      ...rest,
      totalSpots: days.reduce((sum, day) => sum + day.spots.length, 0),
    };
  });

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
      await tx.insert(tripDays).values(
        dates.map((date, i) => ({
          tripId: created.id,
          date,
          dayNumber: i + 1,
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

  return c.json(trip, 201);
});

// Get trip detail with days and spots (any member can view)
tripRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const role = await checkTripAccess(tripId, user.id);
  if (!role) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
    with: {
      days: {
        orderBy: (days, { asc }) => [asc(days.dayNumber)],
        with: {
          spots: {
            orderBy: (spots, { asc }) => [asc(spots.sortOrder)],
          },
        },
      },
    },
  });

  if (!trip) {
    return c.json({ error: "Trip not found" }, 404);
  }

  return c.json(trip);
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
    return c.json({ error: "Trip not found" }, 404);
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
      return c.json({ error: "Trip not found" }, 404);
    }
    return c.json(updated);
  }

  // Fetch current trip to determine full date range
  const currentTrip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
  });
  if (!currentTrip) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const effectiveStart = newStart ?? currentTrip.startDate;
  const effectiveEnd = newEnd ?? currentTrip.endDate;

  // Validate cross-field constraint when only one date is sent
  if (effectiveEnd < effectiveStart) {
    return c.json(
      { error: { fieldErrors: { endDate: ["End date must be on or after start date"] }, formErrors: [] } },
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
      await tx.insert(tripDays).values(
        datesToInsert.map((date) => ({
          tripId,
          date,
          dayNumber: 0, // Will be corrected below
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
    return c.json({ error: "Trip not found" }, 404);
  }

  return c.json(updated);
});

// Delete trip (owner only)
tripRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const role = await checkTripAccess(tripId, user.id);
  if (!isOwner(role)) {
    return c.json({ error: "Trip not found" }, 404);
  }

  await db.delete(trips).where(eq(trips.id, tripId));
  return c.json({ ok: true });
});

export { tripRoutes };
