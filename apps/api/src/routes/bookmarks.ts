import {
  batchBookmarkIdsSchema,
  createBookmarkSchema,
  MAX_BOOKMARKS_PER_LIST,
  reorderBookmarksSchema,
  saveFromSchedulesSchema,
  updateBookmarkSchema,
} from "@sugara/shared";
import { and, count, eq, inArray, max } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { bookmarkLists, bookmarks, schedules } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { hasChanges } from "../lib/has-changes";
import { checkTripAccess } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const bookmarkRoutes = new Hono<AppEnv>();
bookmarkRoutes.use("*", requireAuth);

async function verifyListOwnership(listId: string, userId: string) {
  const list = await db.query.bookmarkLists.findFirst({
    where: eq(bookmarkLists.id, listId),
  });
  if (!list || list.userId !== userId) return null;
  return list;
}

// List bookmarks
bookmarkRoutes.get("/:listId/bookmarks", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const items = await db.query.bookmarks.findMany({
    where: eq(bookmarks.listId, listId),
    orderBy: bookmarks.sortOrder,
  });

  return c.json(items);
});

// Create bookmark
bookmarkRoutes.post("/:listId/bookmarks", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const body = await c.req.json();
  const parsed = createBookmarkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const created = await db.transaction(async (tx) => {
    const [{ count: bmCount }] = await tx
      .select({ count: count() })
      .from(bookmarks)
      .where(eq(bookmarks.listId, listId));

    if (bmCount >= MAX_BOOKMARKS_PER_LIST) {
      return null;
    }

    const [result] = await tx
      .insert(bookmarks)
      .values({
        listId,
        name: parsed.data.name,
        memo: parsed.data.memo ?? null,
        urls: parsed.data.urls,
        sortOrder: bmCount,
      })
      .returning();

    return result;
  });

  if (!created) {
    return c.json({ error: ERROR_MSG.LIMIT_BOOKMARKS }, 409);
  }

  return c.json(created, 201);
});

// Save schedules as bookmarks
bookmarkRoutes.post("/:listId/bookmarks/from-schedules", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const body = await c.req.json();
  const parsed = saveFromSchedulesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Verify user has access to the trip (viewer or above)
  const role = await checkTripAccess(parsed.data.tripId, user.id);
  if (!role) {
    return c.json({ error: ERROR_MSG.SCHEDULE_TRIP_MISMATCH }, 404);
  }

  // Verify all schedules belong to the trip
  const found = await db.query.schedules.findMany({
    where: and(
      inArray(schedules.id, parsed.data.scheduleIds),
      eq(schedules.tripId, parsed.data.tripId),
    ),
  });
  if (found.length !== parsed.data.scheduleIds.length) {
    return c.json({ error: ERROR_MSG.SCHEDULE_TRIP_MISMATCH }, 404);
  }

  const result = await db.transaction(async (tx) => {
    const [{ count: bmCount }] = await tx
      .select({ count: count() })
      .from(bookmarks)
      .where(eq(bookmarks.listId, listId));

    if (bmCount + found.length > MAX_BOOKMARKS_PER_LIST) {
      return null;
    }

    const [{ maxOrder }] = await tx
      .select({ maxOrder: max(bookmarks.sortOrder) })
      .from(bookmarks)
      .where(eq(bookmarks.listId, listId));
    let nextOrder = (maxOrder ?? -1) + 1;

    await tx.insert(bookmarks).values(
      found.map((s) => ({
        listId,
        name: s.name,
        memo: s.memo,
        urls: s.urls,
        sortOrder: nextOrder++,
      })),
    );

    return { count: found.length };
  });

  if (!result) {
    return c.json({ error: ERROR_MSG.LIMIT_BOOKMARKS }, 409);
  }

  return c.json({ ok: true, count: result.count }, 201);
});

// Reorder bookmarks
bookmarkRoutes.patch("/:listId/bookmarks/reorder", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const body = await c.req.json();
  const parsed = reorderBookmarksSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const items = await db.query.bookmarks.findMany({
    where: eq(bookmarks.listId, listId),
    columns: { id: true },
  });
  const ownIds = new Set(items.map((b) => b.id));
  const allOwned = parsed.data.orderedIds.every((id) => ownIds.has(id));
  if (!allOwned) {
    return c.json({ error: ERROR_MSG.BOOKMARK_NOT_FOUND }, 400);
  }

  await db.transaction(async (tx) => {
    await Promise.all(
      parsed.data.orderedIds.map((id, i) =>
        tx.update(bookmarks).set({ sortOrder: i }).where(eq(bookmarks.id, id)),
      ),
    );
  });

  return c.json({ ok: true });
});

// Update bookmark
bookmarkRoutes.patch("/:listId/bookmarks/:bookmarkId", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");
  const bookmarkId = c.req.param("bookmarkId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const body = await c.req.json();
  const parsed = updateBookmarkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.listId, listId)),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.BOOKMARK_NOT_FOUND }, 404);
  }

  if (!hasChanges(existing, parsed.data)) {
    return c.json(existing);
  }

  const [updated] = await db
    .update(bookmarks)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(bookmarks.id, bookmarkId))
    .returning();

  return c.json(updated);
});

// Delete bookmark
bookmarkRoutes.delete("/:listId/bookmarks/:bookmarkId", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");
  const bookmarkId = c.req.param("bookmarkId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.listId, listId)),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.BOOKMARK_NOT_FOUND }, 404);
  }

  await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId));

  return c.json({ ok: true });
});

// Batch delete bookmarks
bookmarkRoutes.post("/:listId/bookmarks/batch-delete", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const body = await c.req.json();
  const parsed = batchBookmarkIdsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const found = await db.query.bookmarks.findMany({
    where: and(inArray(bookmarks.id, parsed.data.bookmarkIds), eq(bookmarks.listId, listId)),
    columns: { id: true },
  });
  if (found.length !== parsed.data.bookmarkIds.length) {
    return c.json({ error: ERROR_MSG.BOOKMARK_NOT_FOUND }, 404);
  }

  await db.delete(bookmarks).where(inArray(bookmarks.id, parsed.data.bookmarkIds));

  return c.json({ ok: true });
});

// Batch duplicate bookmarks
bookmarkRoutes.post("/:listId/bookmarks/batch-duplicate", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const body = await c.req.json();
  const parsed = batchBookmarkIdsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const found = await db.query.bookmarks.findMany({
    where: and(inArray(bookmarks.id, parsed.data.bookmarkIds), eq(bookmarks.listId, listId)),
  });
  if (found.length !== parsed.data.bookmarkIds.length) {
    return c.json({ error: ERROR_MSG.BOOKMARK_NOT_FOUND }, 404);
  }

  const result = await db.transaction(async (tx) => {
    const [{ count: bmCount }] = await tx
      .select({ count: count() })
      .from(bookmarks)
      .where(eq(bookmarks.listId, listId));

    if (bmCount + found.length > MAX_BOOKMARKS_PER_LIST) {
      return null;
    }

    const [{ maxOrder }] = await tx
      .select({ maxOrder: max(bookmarks.sortOrder) })
      .from(bookmarks)
      .where(eq(bookmarks.listId, listId));
    let nextOrder = (maxOrder ?? -1) + 1;

    await tx.insert(bookmarks).values(
      found.map((bm) => ({
        listId,
        name: bm.name,
        memo: bm.memo,
        urls: bm.urls,
        sortOrder: nextOrder++,
      })),
    );

    return true;
  });

  if (!result) {
    return c.json({ error: ERROR_MSG.LIMIT_BOOKMARKS }, 409);
  }

  return c.json({ ok: true }, 201);
});

export { bookmarkRoutes };
