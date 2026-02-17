import type { BookmarkListVisibility } from "@sugara/shared";
import { and, eq, inArray, or } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { bookmarkLists, friends, users } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { optionalAuth } from "../middleware/optional-auth";
import type { OptionalAuthEnv } from "../types";

const profileRoutes = new Hono<OptionalAuthEnv>();

async function areFriends(userA: string, userB: string): Promise<boolean> {
  const record = await db.query.friends.findFirst({
    where: and(
      eq(friends.status, "accepted"),
      or(
        and(eq(friends.requesterId, userA), eq(friends.addresseeId, userB)),
        and(eq(friends.requesterId, userB), eq(friends.addresseeId, userA)),
      ),
    ),
    columns: { id: true },
  });
  return !!record;
}

// Public profile: list bookmark lists filtered by relationship
profileRoutes.get("/:userId/bookmark-lists", optionalAuth, async (c) => {
  const userId = c.req.param("userId");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, name: true, image: true },
  });
  if (!user) {
    return c.json({ error: ERROR_MSG.USER_NOT_FOUND }, 404);
  }

  const viewerId = c.get("user")?.id;

  let visibilityFilter: BookmarkListVisibility[];
  if (viewerId === userId) {
    visibilityFilter = ["private", "friends_only", "public"];
  } else if (viewerId && (await areFriends(viewerId, userId))) {
    visibilityFilter = ["friends_only", "public"];
  } else {
    visibilityFilter = ["public"];
  }

  const lists = await db.query.bookmarkLists.findMany({
    where: and(
      eq(bookmarkLists.userId, userId),
      inArray(bookmarkLists.visibility, visibilityFilter),
    ),
    orderBy: bookmarkLists.sortOrder,
    with: { bookmarks: { columns: { id: true } } },
  });

  return c.json({
    id: user.id,
    name: user.name,
    image: user.image,
    bookmarkLists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      visibility: l.visibility,
      sortOrder: l.sortOrder,
      bookmarkCount: l.bookmarks.length,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  });
});

// Public: single list with bookmarks (access check by visibility)
profileRoutes.get("/:userId/bookmark-lists/:listId", optionalAuth, async (c) => {
  const userId = c.req.param("userId");
  const listId = c.req.param("listId");

  const list = await db.query.bookmarkLists.findFirst({
    where: eq(bookmarkLists.id, listId),
    with: { bookmarks: { orderBy: (b, { asc }) => [asc(b.sortOrder)] } },
  });

  if (!list || list.userId !== userId) {
    return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);
  }

  const viewerId = c.get("user")?.id;

  if (list.visibility === "private" && viewerId !== userId) {
    return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);
  }

  if (list.visibility === "friends_only" && viewerId !== userId) {
    if (!viewerId || !(await areFriends(viewerId, userId))) {
      return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);
    }
  }

  return c.json({
    id: list.id,
    name: list.name,
    visibility: list.visibility,
    sortOrder: list.sortOrder,
    bookmarkCount: list.bookmarks.length,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    bookmarks: list.bookmarks,
  });
});

export { profileRoutes };
