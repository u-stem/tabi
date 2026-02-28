import { and, eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "../db/index";
import {
  notificationPreferences,
  notifications,
  pushSubscriptions,
} from "../db/schema";
import { env } from "./env";
import type { NotificationType } from "@sugara/shared";

webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

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
        body: `${payload.actorName}さんが「${payload.entityName}」を追加しました`,
        url: tripUrl,
      };
    case "schedule_updated":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんが「${payload.entityName}」を更新しました`,
        url: tripUrl,
      };
    case "schedule_deleted":
      return {
        title: payload.tripName ?? "旅行",
        body: `${payload.actorName}さんがスケジュールを削除しました`,
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
        body: `${payload.actorName}さんが経費「${payload.entityName}」を追加しました`,
        url: tripUrl,
      };
  }
}

async function createNotificationInternal(
  params: CreateNotificationParams,
): Promise<void> {
  const { type, userId, tripId, payload } = params;

  const pref = await db.query.notificationPreferences.findFirst({
    where: and(
      eq(notificationPreferences.userId, userId),
      eq(notificationPreferences.type, type),
    ),
  });

  const inAppEnabled = pref?.inApp ?? true;
  const pushEnabled = pref?.push ?? true;

  if (inAppEnabled) {
    await db.insert(notifications).values({ userId, tripId, type, payload });
  }

  if (pushEnabled) {
    void sendPushToUser(userId, type, payload, tripId);
  }
}

async function sendPushToUser(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
  tripId?: string,
): Promise<void> {
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
        .catch(() => {
          // Expired subscriptions fail silently
        }),
    ),
  );
}
