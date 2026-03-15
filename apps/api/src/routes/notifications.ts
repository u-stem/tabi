import { and, count, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { notifications } from "../db/schema";
import { ERROR_MSG, NOTIFICATIONS_LIST_LIMIT } from "../lib/constants";
import { getParam } from "../lib/params";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use("*", requireAuth);

// GET /api/notifications - 通知一覧 + 未読件数
notificationRoutes.get("/", async (c) => {
  const user = c.get("user");

  const [items, unreadRows] = await Promise.all([
    db.query.notifications.findMany({
      where: eq(notifications.userId, user.id),
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit: NOTIFICATIONS_LIST_LIMIT,
    }),
    db
      .select({ unreadCount: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
  ]);

  return c.json({ notifications: items, unreadCount: Number(unreadRows[0]?.unreadCount ?? 0) });
});

// PUT /api/notifications/read-all - 全件既読
notificationRoutes.put("/read-all", async (c) => {
  const user = c.get("user");
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  return c.json({ ok: true });
});

// PUT /api/notifications/:id/read - 1件既読
notificationRoutes.put("/:id/read", async (c) => {
  const user = c.get("user");
  const id = getParam(c, "id");
  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .returning({ id: notifications.id });
  if (!updated) {
    return c.json({ error: ERROR_MSG.NOTIFICATION_NOT_FOUND }, 404);
  }
  return c.json({ ok: true });
});

export { notificationRoutes };
