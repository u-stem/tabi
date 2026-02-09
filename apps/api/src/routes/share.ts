import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { trips } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { checkTripAccess, isOwner } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const shareRoutes = new Hono<AppEnv>();

// Generate or get share link (owner only)
shareRoutes.post("/api/trips/:id/share", requireAuth, async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("id");

  const role = await checkTripAccess(tripId, user.id);
  if (!isOwner(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, tripId),
    columns: { shareToken: true },
  });

  if (trip?.shareToken) {
    return c.json({ shareToken: trip.shareToken });
  }

  // Atomic: only set token if still null (prevents race condition)
  const newToken = crypto.randomUUID().replace(/-/g, "");
  const [updated] = await db
    .update(trips)
    .set({ shareToken: newToken })
    .where(and(eq(trips.id, tripId), isNull(trips.shareToken)))
    .returning({ shareToken: trips.shareToken });

  // If another request already set the token, fetch the existing one
  if (!updated) {
    const refreshed = await db.query.trips.findFirst({
      where: eq(trips.id, tripId),
      columns: { shareToken: true },
    });
    if (!refreshed?.shareToken) {
      return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
    }
    return c.json({ shareToken: refreshed.shareToken });
  }

  return c.json({ shareToken: updated.shareToken });
});

// View shared trip (no auth required)
shareRoutes.get("/api/shared/:token", async (c) => {
  const token = c.req.param("token");

  const trip = await db.query.trips.findFirst({
    where: eq(trips.shareToken, token),
    with: {
      days: {
        orderBy: (days, { asc }) => [asc(days.dayNumber)],
        with: {
          patterns: {
            orderBy: (patterns, { asc }) => [asc(patterns.sortOrder)],
            with: {
              spots: {
                orderBy: (spots, { asc }) => [asc(spots.sortOrder)],
              },
            },
          },
        },
      },
    },
  });

  if (!trip) {
    return c.json({ error: ERROR_MSG.SHARED_NOT_FOUND }, 404);
  }

  // Remove sensitive fields
  const { ownerId, shareToken, ...publicTrip } = trip;
  return c.json(publicTrip);
});

export { shareRoutes };
