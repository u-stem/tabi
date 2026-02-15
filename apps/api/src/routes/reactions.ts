import { reactionSchema } from "@sugara/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { scheduleReactions, schedules } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const reactionRoutes = new Hono<AppEnv>();
reactionRoutes.use("*", requireAuth);

async function getReactionCounts(scheduleId: string) {
  const [counts] = await db
    .select({
      likeCount: sql<number>`count(*) filter (where ${scheduleReactions.type} = 'like')`,
      hmmCount: sql<number>`count(*) filter (where ${scheduleReactions.type} = 'hmm')`,
    })
    .from(scheduleReactions)
    .where(eq(scheduleReactions.scheduleId, scheduleId));
  return { likeCount: counts.likeCount, hmmCount: counts.hmmCount };
}

reactionRoutes.put("/:tripId/candidates/:scheduleId/reaction", requireTripAccess(), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const scheduleId = c.req.param("scheduleId");

  const body = await c.req.json();
  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.schedules.findFirst({
    where: and(
      eq(schedules.id, scheduleId),
      eq(schedules.tripId, tripId),
      isNull(schedules.dayPatternId),
    ),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  const [reaction] = await db
    .insert(scheduleReactions)
    .values({
      scheduleId,
      userId: user.id,
      type: parsed.data.type,
    })
    .onConflictDoUpdate({
      target: [scheduleReactions.scheduleId, scheduleReactions.userId],
      set: { type: parsed.data.type },
    })
    .returning();

  const counts = await getReactionCounts(scheduleId);

  return c.json({ type: reaction.type, ...counts });
});

reactionRoutes.delete(
  "/:tripId/candidates/:scheduleId/reaction",
  requireTripAccess(),
  async (c) => {
    const user = c.get("user");
    const tripId = c.req.param("tripId");
    const scheduleId = c.req.param("scheduleId");

    const existing = await db.query.schedules.findFirst({
      where: and(
        eq(schedules.id, scheduleId),
        eq(schedules.tripId, tripId),
        isNull(schedules.dayPatternId),
      ),
    });
    if (!existing) {
      return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
    }

    await db
      .delete(scheduleReactions)
      .where(
        and(eq(scheduleReactions.scheduleId, scheduleId), eq(scheduleReactions.userId, user.id)),
      );

    const counts = await getReactionCounts(scheduleId);

    return c.json(counts);
  },
);

export { reactionRoutes };
