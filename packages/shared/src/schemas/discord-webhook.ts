import { z } from "zod";
import { notificationTypeSchema } from "./notification";

// Filter out discord_webhook_disabled to prevent recursive notification loops
const discordEnabledTypeValues = notificationTypeSchema.options.filter(
  (t) => t !== "discord_webhook_disabled",
);

export const discordEnabledTypeSchema = z.enum(discordEnabledTypeValues as [string, ...string[]]);

export type DiscordEnabledType = z.infer<typeof discordEnabledTypeSchema>;

export const DISCORD_ENABLED_TYPES_DEFAULT: DiscordEnabledType[] = [
  "member_added",
  "member_removed",
  "expense_added",
  "settlement_checked",
  "poll_started",
  "poll_closed",
];

export const discordWebhookUrlSchema = z
  .string()
  .url()
  .regex(
    /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/,
    "Must be a Discord Webhook URL",
  );

export const localeSchema = z.enum(["ja", "en"]);

export const createDiscordWebhookSchema = z.object({
  webhookUrl: discordWebhookUrlSchema,
  name: z.string().max(100).optional(),
  enabledTypes: z.array(discordEnabledTypeSchema).min(1),
  locale: localeSchema.optional().default("ja"),
});

export type CreateDiscordWebhook = z.infer<typeof createDiscordWebhookSchema>;

export const updateDiscordWebhookSchema = z.object({
  webhookUrl: discordWebhookUrlSchema.optional(),
  name: z.string().max(100).optional(),
  enabledTypes: z.array(discordEnabledTypeSchema).min(1).optional(),
  locale: localeSchema.optional(),
});

export type UpdateDiscordWebhook = z.infer<typeof updateDiscordWebhookSchema>;

export function maskWebhookUrl(url: string): string {
  const parts = url.split("/");
  const token = parts.at(-1) ?? "";
  return `...${token.slice(-8)}`;
}
