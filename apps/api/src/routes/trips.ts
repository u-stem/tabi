import { createTripSchema, updateTripSchema } from "@tabi/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { tripDays, tripMembers, trips } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const tripRoutes = new Hono<AppEnv>();
tripRoutes.use("*", requireAuth);

// List trips for current user
tripRoutes.get("/", async (c) => {
  const user = c.get("user");
  const userTrips = await db.query.trips.findMany({
    where: eq(trips.ownerId, user.id),
    orderBy: (trips, { desc }) => [desc(trips.updatedAt)],
    with: {
      days: {
        with: { spots: { columns: { id: true } } },
      },
    },
  });

  const result = userTrips.map(({ days, ...rest }) => ({
    ...rest,
    totalSpots: days.reduce((sum, day) => sum + day.spots.length, 0),
  }));

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
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const days = [];
    let dayNumber = 1;
    const maxDays = 365;
    for (let d = new Date(start); d <= end && dayNumber <= maxDays; d.setDate(d.getDate() + 1)) {
      // Use local date methods to avoid UTC conversion shifting dates
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const dayOfMonth = String(d.getDate()).padStart(2, "0");
      days.push({
        tripId: created.id,
        date: `${year}-${month}-${dayOfMonth}`,
        dayNumber: dayNumber++,
      });
    }
    if (days.length > 0) {
      await tx.insert(tripDays).values(days);
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

// Get trip detail with days and spots
tripRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const trip = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, user.id)),
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

// Update trip
tripRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTripSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Reject date changes because tripDays would go out of sync
  if (parsed.data.startDate || parsed.data.endDate) {
    return c.json({ error: "Date changes are not supported. Please create a new trip." }, 400);
  }

  const [updated] = await db
    .update(trips)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(trips.id, tripId), eq(trips.ownerId, user.id)))
    .returning();

  if (!updated) {
    return c.json({ error: "Trip not found" }, 404);
  }

  return c.json(updated);
});

// Delete trip
tripRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const existing = await db.query.trips.findFirst({
    where: and(eq(trips.id, tripId), eq(trips.ownerId, user.id)),
  });

  if (!existing) {
    return c.json({ error: "Trip not found" }, 404);
  }

  await db.delete(trips).where(eq(trips.id, tripId));
  return c.json({ ok: true });
});

export { tripRoutes };
