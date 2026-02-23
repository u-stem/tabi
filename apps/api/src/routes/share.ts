import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { trips } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { generateShareToken, shareExpiresAt } from "../lib/share-token";
import { requireAuth } from "../middleware/auth";
import { requireNonGuest } from "../middleware/require-non-guest";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const shareRoutes = new Hono<AppEnv>();

// Generate or get share link (owner only)
shareRoutes.post(
  "/api/trips/:id/share",
  requireAuth,
  requireNonGuest,
  requireTripAccess("owner", "id"),
  async (c) => {
    const tripId = c.req.param("id");

    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, tripId),
      columns: { shareToken: true, shareTokenExpiresAt: true },
    });

    const now = new Date();
    const activeShareTokenExpiresAt = trip?.shareTokenExpiresAt;
    const activeShareToken =
      trip?.shareToken && activeShareTokenExpiresAt && activeShareTokenExpiresAt >= now;

    if (activeShareToken) {
      return c.json({
        shareToken: trip.shareToken,
        shareTokenExpiresAt: activeShareTokenExpiresAt.toISOString(),
      });
    }

    // Generate new token (or replace expired / legacy one)
    const expiresAt = shareExpiresAt();
    const whereCondition = trip?.shareToken
      ? eq(trips.id, tripId)
      : and(eq(trips.id, tripId), isNull(trips.shareToken));
    const [updated] = await db
      .update(trips)
      .set({ shareToken: generateShareToken(), shareTokenExpiresAt: expiresAt })
      .where(whereCondition)
      .returning({ shareToken: trips.shareToken, shareTokenExpiresAt: trips.shareTokenExpiresAt });

    // If another request already set the token, fetch the existing one
    if (!updated) {
      const refreshed = await db.query.trips.findFirst({
        where: eq(trips.id, tripId),
        columns: { shareToken: true, shareTokenExpiresAt: true },
      });
      if (!refreshed?.shareToken) {
        return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
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
  },
);

// Regenerate share link (owner only)
shareRoutes.put(
  "/api/trips/:id/share",
  requireAuth,
  requireNonGuest,
  requireTripAccess("owner", "id"),
  async (c) => {
    const tripId = c.req.param("id");

    const expiresAt = shareExpiresAt();
    const [updated] = await db
      .update(trips)
      .set({ shareToken: generateShareToken(), shareTokenExpiresAt: expiresAt })
      .where(eq(trips.id, tripId))
      .returning({ shareToken: trips.shareToken, shareTokenExpiresAt: trips.shareTokenExpiresAt });

    if (!updated) {
      return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
    }

    return c.json({
      shareToken: updated.shareToken,
      shareTokenExpiresAt: updated.shareTokenExpiresAt?.toISOString() ?? null,
    });
  },
);

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
    return c.json({ error: ERROR_MSG.SHARED_NOT_FOUND }, 404);
  }

  if (trip.shareTokenExpiresAt && trip.shareTokenExpiresAt < new Date()) {
    return c.json({ error: ERROR_MSG.SHARED_NOT_FOUND }, 404);
  }

  // Remove sensitive fields, but expose expiry as ISO string for UI
  const { ownerId, shareToken, shareTokenExpiresAt: _expiry, ...publicTrip } = trip;
  return c.json({
    ...publicTrip,
    shareExpiresAt: trip.shareTokenExpiresAt?.toISOString() ?? null,
  });
});

export { shareRoutes };
