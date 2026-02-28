import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "member_added",
  "member_removed",
  "role_changed",
  "schedule_created",
  "schedule_updated",
  "schedule_deleted",
  "poll_started",
  "poll_closed",
  "expense_added",
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const updateNotificationPreferenceSchema = z.object({
  type: notificationTypeSchema,
  inApp: z.boolean().optional(),
  push: z.boolean().optional(),
});

export const createPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});
