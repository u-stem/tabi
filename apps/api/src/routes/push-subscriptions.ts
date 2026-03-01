import { createPushSubscriptionSchema } from "@sugara/shared";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { pushSubscriptions } from "../db/schema";
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

  // Count other subscriptions for this user (excluding the incoming endpoint which may already exist)
  const [{ count: otherCount }] = await db
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
    const oldest = await db.query.pushSubscriptions.findFirst({
      where: and(
        eq(pushSubscriptions.userId, user.id),
        ne(pushSubscriptions.endpoint, parsed.data.endpoint),
      ),
      orderBy: [asc(pushSubscriptions.createdAt)],
      columns: { id: true },
    });
    if (oldest) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, oldest.id));
    }
  }

  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, ...parsed.data })
    .onConflictDoNothing();

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

export { pushSubscriptionRoutes };
