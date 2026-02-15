import { updateTripDaySchema } from "@sugara/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { tripDays } from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const tripDayRoutes = new Hono<AppEnv>();
tripDayRoutes.use("*", requireAuth);

// Update trip day (memo)
tripDayRoutes.patch("/:tripId/days/:dayId", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");

  const body = await c.req.json();
  const parsed = updateTripDaySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.DAY_NOT_FOUND }, 404);
  }

  const [updated] = await db
    .update(tripDays)
    .set({ memo: parsed.data.memo })
    .where(eq(tripDays.id, dayId))
    .returning();

  logActivity({
    tripId,
    userId: user.id,
    action: "updated",
    entityType: "day_memo",
    detail: `${existing.dayNumber}日目`,
  });

  return c.json(updated);
});

export { tripDayRoutes };
