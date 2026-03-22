import type { DiscordEmbed } from "@sugara/shared";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { discordWebhooks } from "../db/schema";
import { logger } from "./logger";
import { notifyUsers } from "./notifications";

const FAILURE_THRESHOLD = 5;

type SendWebhookParams = {
  webhookId: string;
  webhookUrl: string;
  embed: DiscordEmbed;
};

export async function validateWebhookUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendDiscordWebhook(params: SendWebhookParams): Promise<void> {
  const { webhookId, webhookUrl, embed } = params;

  const body = JSON.stringify({ embeds: [embed] });
  const headers = { "Content-Type": "application/json" };

  let res: Response;
  try {
    res = await fetch(webhookUrl, { method: "POST", headers, body });
  } catch (err) {
    logger.error({ err, webhookId }, "Discord webhook network error");
    await incrementFailureCount(webhookId);
    return;
  }

  if (res.ok) {
    await db
      .update(discordWebhooks)
      .set({ lastSuccessAt: new Date(), failureCount: 0, updatedAt: new Date() })
      .where(eq(discordWebhooks.id, webhookId));
    return;
  }

  // 404/401 — webhook invalid, deactivate immediately
  if (res.status === 404 || res.status === 401) {
    await deactivateWebhook(webhookId);
    return;
  }

  // 5xx — retry once immediately
  if (res.status >= 500) {
    try {
      const retryRes = await fetch(webhookUrl, { method: "POST", headers, body });
      if (retryRes.ok) {
        await db
          .update(discordWebhooks)
          .set({ lastSuccessAt: new Date(), failureCount: 0, updatedAt: new Date() })
          .where(eq(discordWebhooks.id, webhookId));
        return;
      }
    } catch {
      // retry failed, fall through to increment failure count
    }
    await incrementFailureCount(webhookId);
  }
}

async function incrementFailureCount(webhookId: string): Promise<void> {
  const [updated] = await db
    .update(discordWebhooks)
    .set({
      failureCount: sql`${discordWebhooks.failureCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(discordWebhooks.id, webhookId))
    .returning({ failureCount: discordWebhooks.failureCount });

  if (updated && updated.failureCount >= FAILURE_THRESHOLD) {
    await deactivateWebhook(webhookId);
  }
}

async function deactivateWebhook(webhookId: string): Promise<void> {
  await db
    .update(discordWebhooks)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(discordWebhooks.id, webhookId));

  const webhook = await db.query.discordWebhooks.findFirst({
    where: eq(discordWebhooks.id, webhookId),
    columns: { tripId: true, createdBy: true },
  });

  if (webhook) {
    notifyUsers({
      type: "discord_webhook_disabled",
      tripId: webhook.tripId,
      userIds: [webhook.createdBy],
      makePayload: (tripName) => ({ tripName }),
    });
  }

  logger.info({ webhookId }, "Discord webhook deactivated");
}
