import {
  acceptFriendRequestSchema,
  friendRequestSchema,
  MAX_FRIENDS_PER_USER,
} from "@sugara/shared";
import { and, count, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { friends, users } from "../db/schema";
import { ERROR_MSG, PG_UNIQUE_VIOLATION } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import { requireNonGuest } from "../middleware/require-non-guest";
import type { AppEnv } from "../types";

const friendRoutes = new Hono<AppEnv>();
friendRoutes.use("*", requireAuth);
friendRoutes.use("*", requireNonGuest);

// List accepted friends
friendRoutes.get("/", async (c) => {
  const user = c.get("user");

  const records = await db.query.friends.findMany({
    where: and(
      eq(friends.status, "accepted"),
      or(eq(friends.requesterId, user.id), eq(friends.addresseeId, user.id)),
    ),
    with: {
      requester: { columns: { id: true, name: true, image: true } },
      addressee: { columns: { id: true, name: true, image: true } },
    },
  });

  return c.json(
    records.map((r) => {
      const isRequester = r.requesterId === user.id;
      const other = isRequester ? r.addressee : r.requester;
      return {
        friendId: r.id,
        userId: other.id,
        name: other.name,
        image: other.image,
      };
    }),
  );
});

// List received pending requests
friendRoutes.get("/requests", async (c) => {
  const user = c.get("user");

  const records = await db.query.friends.findMany({
    where: and(eq(friends.status, "pending"), eq(friends.addresseeId, user.id)),
    with: {
      requester: { columns: { id: true, name: true, image: true } },
    },
  });

  return c.json(
    records.map((r) => ({
      id: r.id,
      requesterId: r.requesterId,
      name: r.requester.name,
      image: r.requester.image,
      createdAt: r.createdAt,
    })),
  );
});

// Send friend request
friendRoutes.post("/requests", async (c) => {
  const user = c.get("user");

  const body = await c.req.json();
  const parsed = friendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { addresseeId } = parsed.data;

  if (addresseeId === user.id) {
    return c.json({ error: ERROR_MSG.CANNOT_FRIEND_SELF }, 400);
  }

  const [[friendCount], targetUser, existing] = await Promise.all([
    db
      .select({ count: count() })
      .from(friends)
      .where(
        and(
          eq(friends.status, "accepted"),
          or(eq(friends.requesterId, user.id), eq(friends.addresseeId, user.id)),
        ),
      ),
    db.query.users.findFirst({ where: eq(users.id, addresseeId) }),
    db.query.friends.findFirst({
      where: or(
        and(eq(friends.requesterId, user.id), eq(friends.addresseeId, addresseeId)),
        and(eq(friends.requesterId, addresseeId), eq(friends.addresseeId, user.id)),
      ),
    }),
  ]);
  if (friendCount.count >= MAX_FRIENDS_PER_USER) {
    return c.json({ error: ERROR_MSG.LIMIT_FRIENDS }, 409);
  }
  if (!targetUser) {
    return c.json({ error: ERROR_MSG.USER_NOT_FOUND }, 404);
  }
  if (existing) {
    return c.json({ error: ERROR_MSG.ALREADY_FRIENDS }, 409);
  }

  try {
    const [created] = await db
      .insert(friends)
      .values({
        requesterId: user.id,
        addresseeId,
      })
      .returning({ id: friends.id });

    return c.json({ id: created.id }, 201);
  } catch (e) {
    // Unique constraint violation from friends_pair_unique index (race condition)
    if (e instanceof Error && "code" in e && e.code === PG_UNIQUE_VIOLATION) {
      return c.json({ error: ERROR_MSG.ALREADY_FRIENDS }, 409);
    }
    throw e;
  }
});

// Accept friend request
friendRoutes.patch("/requests/:id", async (c) => {
  const user = c.get("user");
  const requestId = c.req.param("id");

  const body = await c.req.json();
  const parsed = acceptFriendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const record = await db.query.friends.findFirst({
    where: and(eq(friends.id, requestId), eq(friends.status, "pending")),
  });
  if (!record) {
    return c.json({ error: ERROR_MSG.FRIEND_REQUEST_NOT_FOUND }, 404);
  }

  // Only addressee can accept
  if (record.addresseeId !== user.id) {
    return c.json({ error: ERROR_MSG.FRIEND_REQUEST_NOT_FOUND }, 404);
  }

  await db
    .update(friends)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(friends.id, requestId));

  return c.json({ ok: true });
});

// Reject or cancel friend request
friendRoutes.delete("/requests/:id", async (c) => {
  const user = c.get("user");
  const requestId = c.req.param("id");

  const record = await db.query.friends.findFirst({
    where: and(eq(friends.id, requestId), eq(friends.status, "pending")),
  });
  if (!record) {
    return c.json({ error: ERROR_MSG.FRIEND_REQUEST_NOT_FOUND }, 404);
  }

  // Only requester or addressee can delete
  if (record.requesterId !== user.id && record.addresseeId !== user.id) {
    return c.json({ error: ERROR_MSG.FRIEND_REQUEST_NOT_FOUND }, 404);
  }

  await db.delete(friends).where(eq(friends.id, requestId));

  return c.json({ ok: true });
});

// Remove friend
friendRoutes.delete("/:friendId", async (c) => {
  const user = c.get("user");
  const friendId = c.req.param("friendId");

  const record = await db.query.friends.findFirst({
    where: and(eq(friends.id, friendId), eq(friends.status, "accepted")),
  });
  if (!record) {
    return c.json({ error: ERROR_MSG.FRIEND_NOT_FOUND }, 404);
  }

  // Only requester or addressee can remove
  if (record.requesterId !== user.id && record.addresseeId !== user.id) {
    return c.json({ error: ERROR_MSG.FRIEND_NOT_FOUND }, 404);
  }

  await db.delete(friends).where(eq(friends.id, friendId));

  return c.json({ ok: true });
});

export { friendRoutes };
