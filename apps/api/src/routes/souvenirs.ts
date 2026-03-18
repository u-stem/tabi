import {
  createSouvenirSchema,
  MAX_SOUVENIRS_PER_USER_PER_TRIP,
  updateSouvenirSchema,
} from "@sugara/shared";
import { and, count, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { souvenirItems, users } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { getParam } from "../lib/params";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const souvenirRoutes = new Hono<AppEnv>();
souvenirRoutes.use("*", requireAuth);

const souvenirItemColumns = {
  id: souvenirItems.id,
  name: souvenirItems.name,
  recipient: souvenirItems.recipient,
  urls: souvenirItems.urls,
  addresses: souvenirItems.addresses,
  memo: souvenirItems.memo,
  priority: souvenirItems.priority,
  isPurchased: souvenirItems.isPurchased,
  isShared: souvenirItems.isShared,
  shareStyle: souvenirItems.shareStyle,
  userId: souvenirItems.userId,
  userName: users.name,
  userImage: users.image,
  createdAt: souvenirItems.createdAt,
  updatedAt: souvenirItems.updatedAt,
} as const;

async function findSouvenirWithUser(itemId: string) {
  const [row] = await db
    .select(souvenirItemColumns)
    .from(souvenirItems)
    .innerJoin(users, eq(souvenirItems.userId, users.id))
    .where(eq(souvenirItems.id, itemId));
  return row;
}

// GET /api/trips/:tripId/souvenirs — own items + other members' shared items
souvenirRoutes.get("/:tripId/souvenirs", requireTripAccess(), async (c) => {
  const tripId = getParam(c, "tripId");
  const user = c.get("user");

  const rows = await db
    .select(souvenirItemColumns)
    .from(souvenirItems)
    .innerJoin(users, eq(souvenirItems.userId, users.id))
    .where(
      and(
        eq(souvenirItems.tripId, tripId),
        or(eq(souvenirItems.userId, user.id), eq(souvenirItems.isShared, true)),
      ),
    )
    .orderBy(souvenirItems.createdAt);

  return c.json({ items: rows });
});

// POST /api/trips/:tripId/souvenirs
souvenirRoutes.post("/:tripId/souvenirs", requireTripAccess(), async (c) => {
  const tripId = getParam(c, "tripId");
  const user = c.get("user");

  const body = await c.req.json();
  const parsed = createSouvenirSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? ERROR_MSG.INVALID_INPUT }, 400);
  }

  const [{ itemCount }] = await db
    .select({ itemCount: count() })
    .from(souvenirItems)
    .where(and(eq(souvenirItems.tripId, tripId), eq(souvenirItems.userId, user.id)));

  if (itemCount >= MAX_SOUVENIRS_PER_USER_PER_TRIP) {
    return c.json({ error: ERROR_MSG.LIMIT_SOUVENIRS }, 409);
  }

  const { name, recipient, urls, addresses, memo, priority, isShared, shareStyle } = parsed.data;
  const resolvedIsShared = isShared ?? false;
  const [inserted] = await db
    .insert(souvenirItems)
    .values({
      tripId,
      userId: user.id,
      name,
      recipient,
      urls,
      addresses,
      memo,
      priority,
      isShared: resolvedIsShared,
      shareStyle: resolvedIsShared ? (shareStyle ?? null) : null,
    })
    .returning({ id: souvenirItems.id });

  const item = await findSouvenirWithUser(inserted.id);
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
    return c.json({ error: parsed.error.issues[0]?.message ?? ERROR_MSG.INVALID_INPUT }, 400);
  }

  const updateData = { ...parsed.data };
  const resolvedIsShared = updateData.isShared ?? existing.isShared;
  if (!resolvedIsShared) {
    updateData.shareStyle = null;
  }

  await db.update(souvenirItems).set(updateData).where(eq(souvenirItems.id, itemId));

  const updated = await findSouvenirWithUser(itemId);
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
