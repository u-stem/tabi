import {
  createPushSubscriptionSchema,
  NOTIFICATION_DEFAULTS,
  notificationTypeSchema,
  updatePushSubscriptionPreferenceSchema,
} from "@sugara/shared";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { pushSubscriptions } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const MAX_SUBSCRIPTIONS_PER_USER = 5;

const pushSubscriptionRoutes = new Hono<AppEnv>();
pushSubscriptionRoutes.use("*", requireAuth);

// POST /api/push-subscriptions - 購読を保存
pushSubscriptionRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createPushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  await db.transaction(async (tx) => {
    // Count other subscriptions for this user (excluding the incoming endpoint which may already exist)
    const [{ count: otherCount }] = await tx
      .select({ count: count() })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, user.id),
          ne(pushSubscriptions.endpoint, parsed.data.endpoint),
        ),
      );

    // Enforce per-user subscription limit: remove the oldest if a new endpoint would exceed it
    if (Number(otherCount) >= MAX_SUBSCRIPTIONS_PER_USER) {
      const oldest = await tx.query.pushSubscriptions.findFirst({
        where: and(
          eq(pushSubscriptions.userId, user.id),
          ne(pushSubscriptions.endpoint, parsed.data.endpoint),
        ),
        orderBy: [asc(pushSubscriptions.createdAt)],
        columns: { id: true },
      });
      if (oldest) {
        await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.id, oldest.id));
      }
    }

    await tx
      .insert(pushSubscriptions)
      .values({ userId: user.id, ...parsed.data })
      .onConflictDoNothing();
  });

  return c.json({ ok: true }, 201);
});

// DELETE /api/push-subscriptions - 購読を削除（ログアウト時）
pushSubscriptionRoutes.delete("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { endpoint } = body as Record<string, unknown>;
  if (typeof endpoint !== "string" || !URL.canParse(endpoint)) {
    return c.json({ error: "Invalid endpoint URL" }, 400);
  }

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint)));

  return c.json({ ok: true });
});

// GET /api/push-subscriptions/preferences?endpoint=<url>
pushSubscriptionRoutes.get("/preferences", async (c) => {
  const user = c.get("user");
  const endpoint = c.req.query("endpoint");
  if (!endpoint) {
    return c.json({ error: "endpoint query parameter required" }, 400);
  }

  const sub = await db.query.pushSubscriptions.findFirst({
    where: and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint)),
  });
  if (!sub) return c.json({ error: ERROR_MSG.NOT_FOUND }, 404);

  const prefs = sub.preferences as Record<string, boolean>;
  const ALL_TYPES = notificationTypeSchema.options;
  const expanded = Object.fromEntries(
    ALL_TYPES.map((type) => [type, prefs[type] ?? NOTIFICATION_DEFAULTS[type].push]),
  );

  return c.json(expanded);
});

// PUT /api/push-subscriptions/preferences
pushSubscriptionRoutes.put("/preferences", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = updatePushSubscriptionPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { endpoint, type, enabled } = parsed.data;
  const sub = await db.query.pushSubscriptions.findFirst({
    where: and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint)),
  });
  if (!sub) return c.json({ error: ERROR_MSG.NOT_FOUND }, 404);

  const currentPrefs = sub.preferences as Record<string, boolean>;
  await db
    .update(pushSubscriptions)
    .set({ preferences: { ...currentPrefs, [type]: enabled } })
    .where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint)));

  return c.json({ ok: true });
});

export { pushSubscriptionRoutes };
