import {
  NOTIFICATION_DEFAULTS,
  notificationTypeSchema,
  updateNotificationPreferenceSchema,
} from "@sugara/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { notificationPreferences } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const notificationPreferenceRoutes = new Hono<AppEnv>();
notificationPreferenceRoutes.use("*", requireAuth);

const ALL_TYPES = notificationTypeSchema.options;

// GET /api/notification-preferences - 設定一覧（未設定は default ON で補完）
notificationPreferenceRoutes.get("/", async (c) => {
  const user = c.get("user");
  const saved = await db.query.notificationPreferences.findMany({
    where: eq(notificationPreferences.userId, user.id),
  });

  const savedMap = new Map(saved.map((p) => [p.type, p]));
  const prefs = ALL_TYPES.map((type) => ({
    type,
    inApp: savedMap.get(type)?.inApp ?? NOTIFICATION_DEFAULTS[type].inApp,
  }));

  return c.json(prefs);
});

// PUT /api/notification-preferences - 1種別の設定を更新
notificationPreferenceRoutes.put("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = updateNotificationPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const type = parsed.data.type;
  await db
    .insert(notificationPreferences)
    .values({
      userId: user.id,
      type,
      inApp: parsed.data.inApp ?? NOTIFICATION_DEFAULTS[type].inApp,
    })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.type],
      set: {
        ...(parsed.data.inApp !== undefined && { inApp: parsed.data.inApp }),
      },
    });

  return c.json({ ok: true });
});

export { notificationPreferenceRoutes };
