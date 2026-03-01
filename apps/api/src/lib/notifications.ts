import { NOTIFICATION_DEFAULTS, type NotificationType } from "@sugara/shared";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "../db/index";
import { notificationPreferences, notifications, pushSubscriptions } from "../db/schema";
import { env } from "./env";

const MAX_NOTIFICATIONS_PER_USER = 100;

// Lazy VAPID setup: configured on first push send to avoid crashing at import
// when VAPID env vars are absent (e.g. in unit tests).
let vapidConfigured = false;
function ensureVapid() {
  if (!vapidConfigured && env.VAPID_PUBLIC_KEY) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  }
}

export type NotificationPayload = {
  actorName?: string;
  tripName?: string;
  entityName?: string;
  newRole?: string;
  [key: string]: string | undefined;
};

type CreateNotificationParams = {
  type: NotificationType;
  userId: string;
  tripId?: string;
  payload: NotificationPayload;
};

/**
 * Fire-and-forget notification creation. Errors are caught internally.
 */
export function createNotification(params: CreateNotificationParams): Promise<void> {
  return createNotificationInternal(params).catch((err) => {
    console.error("[createNotification]", params.type, err);
  });
}

function buildPushMessage(
  type: NotificationType,
  payload: NotificationPayload,
  tripId?: string,
): { title: string; body: string; url: string } {
  const tripUrl = tripId ? `/trips/${tripId}` : "/";
  switch (type) {
    case "member_added":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんがあなたを招待しました`,
        url: tripUrl,
      };
    case "member_removed":
      return {
        title: payload.tripName ?? "旅行",
        body: "旅行メンバーから削除されました",
        url: "/",
      };
    case "role_changed":
      return {
        title: payload.tripName ?? "旅行",
        body: `あなたのロールが「${payload.newRole}」に変更されました`,
        url: tripUrl,
      };
    case "schedule_created":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんが予定「${payload.entityName}」を追加しました`,
        url: tripUrl,
      };
    case "schedule_updated":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんが予定「${payload.entityName}」を更新しました`,
        url: tripUrl,
      };
    case "schedule_deleted":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんが予定を削除しました`,
        url: tripUrl,
      };
    case "poll_started":
      return {
        title: payload.tripName ?? "旅行",
        body: "日程投票が開始されました",
        url: tripUrl,
      };
    case "poll_closed":
      return {
        title: payload.tripName ?? "旅行",
        body: "日程投票が終了しました",
        url: tripUrl,
      };
    case "expense_added":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんが費用「${payload.entityName}」を追加しました`,
        url: tripUrl,
      };
  }
}

async function createNotificationInternal(params: CreateNotificationParams): Promise<void> {
  const { type, userId, tripId, payload } = params;

  const pref = await db.query.notificationPreferences.findFirst({
    where: and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.type, type)),
  });

  const inAppEnabled = pref?.inApp ?? NOTIFICATION_DEFAULTS[type].inApp;
  const pushEnabled = pref?.push ?? NOTIFICATION_DEFAULTS[type].push;

  if (inAppEnabled) {
    await db.insert(notifications).values({ userId, tripId, type, payload });
    void pruneOldNotifications(userId);
  }

  if (pushEnabled) {
    void sendPushToUser(userId, type, payload, tripId);
  }
}

async function pruneOldNotifications(userId: string): Promise<void> {
  const [{ count: total }] = await db
    .select({ count: count() })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  const excess = Number(total) - MAX_NOTIFICATIONS_PER_USER;
  if (excess <= 0) return;

  const oldest = await db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [asc(notifications.createdAt)],
    limit: excess,
    columns: { id: true },
  });
  if (oldest.length > 0) {
    await db.delete(notifications).where(
      inArray(
        notifications.id,
        oldest.map((n) => n.id),
      ),
    );
  }
}

async function sendPushToUser(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
  tripId?: string,
): Promise<void> {
  ensureVapid();
  const subs = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, userId),
  });
  if (subs.length === 0) return;

  const message = buildPushMessage(type, payload, tripId);
  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(message),
        )
        .catch(async (err: unknown) => {
          // 410 Gone / 404 Not Found means the subscription has expired; remove it
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 410 || status === 404) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
          }
        }),
    ),
  );
}
