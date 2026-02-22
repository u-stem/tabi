import { CHAT_SESSION_TTL_HOURS, sendChatMessageSchema } from "@sugara/shared";
import { and, desc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { chatMessages, chatSessions, users } from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { ERROR_MSG, PG_UNIQUE_VIOLATION } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const MESSAGES_PER_PAGE = 50;

async function cleanupExpiredSession(tripId: string): Promise<void> {
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.tripId, tripId),
  });
  if (!session) return;

  const ttlMs = CHAT_SESSION_TTL_HOURS * 60 * 60 * 1000;
  if (Date.now() - session.lastMessageAt.getTime() > ttlMs) {
    await db.delete(chatSessions).where(eq(chatSessions.id, session.id));
  }
}

const chatRoutes = new Hono<AppEnv>();
chatRoutes.use("*", requireAuth);

// GET /:tripId/chat/session
chatRoutes.get("/:tripId/chat/session", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");
  await cleanupExpiredSession(tripId);

  const rows = await db
    .select({
      id: chatSessions.id,
      startedByUserId: chatSessions.startedBy,
      startedByName: users.name,
      startedByImage: users.image,
      createdAt: chatSessions.createdAt,
      lastMessageAt: chatSessions.lastMessageAt,
    })
    .from(chatSessions)
    .innerJoin(users, eq(chatSessions.startedBy, users.id))
    .where(eq(chatSessions.tripId, tripId))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ session: null });
  }

  const s = rows[0];
  return c.json({
    session: {
      id: s.id,
      startedBy: { userId: s.startedByUserId, name: s.startedByName, image: s.startedByImage },
      createdAt: s.createdAt.toISOString(),
      lastMessageAt: s.lastMessageAt.toISOString(),
    },
  });
});

// POST /:tripId/chat/session
chatRoutes.post("/:tripId/chat/session", requireTripAccess("editor"), async (c) => {
  const tripId = c.req.param("tripId");
  const user = c.get("user");

  await cleanupExpiredSession(tripId);

  const existing = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.tripId, tripId),
  });
  if (existing) {
    return c.json({ error: ERROR_MSG.CHAT_SESSION_ALREADY_EXISTS }, 409);
  }

  let session: { id: string; createdAt: Date; lastMessageAt: Date };
  try {
    [session] = await db.insert(chatSessions).values({ tripId, startedBy: user.id }).returning();
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === PG_UNIQUE_VIOLATION) {
      return c.json({ error: ERROR_MSG.CHAT_SESSION_ALREADY_EXISTS }, 409);
    }
    throw err;
  }

  const [dbUser] = await db
    .select({ name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  logActivity({
    tripId,
    userId: user.id,
    action: "created",
    entityType: "chat_session",
    entityName: "作戦会議",
  });

  return c.json(
    {
      session: {
        id: session.id,
        startedBy: { userId: user.id, name: dbUser.name, image: dbUser.image },
        createdAt: session.createdAt.toISOString(),
        lastMessageAt: session.lastMessageAt.toISOString(),
      },
    },
    201,
  );
});

// DELETE /:tripId/chat/session
chatRoutes.delete("/:tripId/chat/session", requireTripAccess("editor"), async (c) => {
  const tripId = c.req.param("tripId");
  const user = c.get("user");

  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.tripId, tripId),
  });
  if (!session) {
    return c.json({ error: ERROR_MSG.CHAT_SESSION_NOT_FOUND }, 404);
  }

  await db.delete(chatSessions).where(eq(chatSessions.id, session.id));

  logActivity({
    tripId,
    userId: user.id,
    action: "deleted",
    entityType: "chat_session",
    entityName: "作戦会議",
  });

  return c.body(null, 204);
});

// GET /:tripId/chat/messages
chatRoutes.get("/:tripId/chat/messages", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");
  await cleanupExpiredSession(tripId);

  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.tripId, tripId),
  });
  if (!session) {
    return c.json({ items: [], nextCursor: null });
  }

  const limit = MESSAGES_PER_PAGE;
  const cursor = c.req.query("cursor");
  if (cursor && Number.isNaN(Date.parse(cursor))) {
    return c.json({ error: "Invalid cursor" }, 400);
  }

  const whereConditions = cursor
    ? and(eq(chatMessages.sessionId, session.id), lt(chatMessages.createdAt, new Date(cursor)))
    : eq(chatMessages.sessionId, session.id);

  const messages = await db
    .select({
      id: chatMessages.id,
      userId: chatMessages.userId,
      userName: users.name,
      userImage: users.image,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.userId, users.id))
    .where(whereConditions)
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return c.json({
    items: items.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    nextCursor,
  });
});

// POST /:tripId/chat/messages
chatRoutes.post("/:tripId/chat/messages", requireTripAccess("editor"), async (c) => {
  const tripId = c.req.param("tripId");
  const user = c.get("user");

  await cleanupExpiredSession(tripId);

  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.tripId, tripId),
  });
  if (!session) {
    return c.json({ error: ERROR_MSG.CHAT_SESSION_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = sendChatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [message] = await db
    .insert(chatMessages)
    .values({
      sessionId: session.id,
      userId: user.id,
      content: parsed.data.content,
    })
    .returning();

  await db
    .update(chatSessions)
    .set({ lastMessageAt: message.createdAt })
    .where(eq(chatSessions.id, session.id));

  const [dbUser] = await db
    .select({ name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return c.json(
    {
      id: message.id,
      userId: user.id,
      userName: dbUser.name,
      userImage: dbUser.image,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    },
    201,
  );
});

export { chatRoutes };
