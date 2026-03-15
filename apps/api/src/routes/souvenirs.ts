import {
  createSouvenirSchema,
  MAX_SOUVENIRS_PER_USER_PER_TRIP,
  updateSouvenirSchema,
} from "@sugara/shared";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { souvenirItems } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { getParam } from "../lib/params";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const souvenirRoutes = new Hono<AppEnv>();
souvenirRoutes.use("*", requireAuth);

// GET /api/trips/:tripId/souvenirs — own items only
souvenirRoutes.get("/:tripId/souvenirs", requireTripAccess(), async (c) => {
  const tripId = getParam(c, "tripId");
  const user = c.get("user");

  const items = await db.query.souvenirItems.findMany({
    where: and(eq(souvenirItems.tripId, tripId), eq(souvenirItems.userId, user.id)),
    orderBy: (souvenirItems, { asc }) => [asc(souvenirItems.createdAt)],
  });

  return c.json({ items });
});

// POST /api/trips/:tripId/souvenirs
souvenirRoutes.post("/:tripId/souvenirs", requireTripAccess(), async (c) => {
  const tripId = getParam(c, "tripId");
  const user = c.get("user");

  const body = await c.req.json();
  const parsed = createSouvenirSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const [{ itemCount }] = await db
    .select({ itemCount: count() })
    .from(souvenirItems)
    .where(and(eq(souvenirItems.tripId, tripId), eq(souvenirItems.userId, user.id)));

  if (itemCount >= MAX_SOUVENIRS_PER_USER_PER_TRIP) {
    return c.json({ error: ERROR_MSG.LIMIT_SOUVENIRS }, 409);
  }

  const { name, recipient, urls, addresses, memo, priority } = parsed.data;
  const [item] = await db
    .insert(souvenirItems)
    .values({ tripId, userId: user.id, name, recipient, urls, addresses, memo, priority })
    .returning();

  return c.json(item, 201);
});

// PATCH /api/trips/:tripId/souvenirs/:itemId
souvenirRoutes.patch("/:tripId/souvenirs/:itemId", requireTripAccess(), async (c) => {
  const tripId = getParam(c, "tripId");
  const itemId = getParam(c, "itemId");
  const user = c.get("user");

  const existing = await db.query.souvenirItems.findFirst({
    where: and(
      eq(souvenirItems.id, itemId),
      eq(souvenirItems.tripId, tripId),
      eq(souvenirItems.userId, user.id),
    ),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.SOUVENIR_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = updateSouvenirSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, 400);
  }

  const [updated] = await db
    .update(souvenirItems)
    .set(parsed.data)
    .where(eq(souvenirItems.id, itemId))
    .returning();

  return c.json(updated);
});

// DELETE /api/trips/:tripId/souvenirs/:itemId
souvenirRoutes.delete("/:tripId/souvenirs/:itemId", requireTripAccess(), async (c) => {
  const tripId = getParam(c, "tripId");
  const itemId = getParam(c, "itemId");
  const user = c.get("user");

  const existing = await db.query.souvenirItems.findFirst({
    where: and(
      eq(souvenirItems.id, itemId),
      eq(souvenirItems.tripId, tripId),
      eq(souvenirItems.userId, user.id),
    ),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.SOUVENIR_NOT_FOUND }, 404);
  }

  await db.delete(souvenirItems).where(eq(souvenirItems.id, itemId));

  return new Response(null, { status: 204 });
});

export { souvenirRoutes };
