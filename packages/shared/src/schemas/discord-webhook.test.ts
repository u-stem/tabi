import { describe, expect, it } from "vitest";
import {
  createDiscordWebhookSchema,
  DISCORD_ENABLED_TYPES_DEFAULT,
  discordWebhookUrlSchema,
  maskWebhookUrl,
  updateDiscordWebhookSchema,
} from "./discord-webhook";

describe("discordWebhookUrlSchema", () => {
  it("accepts valid discord webhook URL", () => {
    const result = discordWebhookUrlSchema.safeParse(
      "https://discord.com/api/webhooks/123456/abcdef",
    );
    expect(result.success).toBe(true);
  });

  it("accepts discordapp.com webhook URL", () => {
    const result = discordWebhookUrlSchema.safeParse(
      "https://discordapp.com/api/webhooks/123456/abcdef",
    );
    expect(result.success).toBe(true);
  });

  it("rejects non-discord URL", () => {
    const result = discordWebhookUrlSchema.safeParse("https://example.com/webhooks/123");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = discordWebhookUrlSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("createDiscordWebhookSchema", () => {
  it("accepts valid payload with webhookUrl and enabledTypes", () => {
    const result = createDiscordWebhookSchema.safeParse({
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      enabledTypes: ["member_added", "schedule_created"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload without name (optional)", () => {
    const result = createDiscordWebhookSchema.safeParse({
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      enabledTypes: ["member_added"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects discord_webhook_disabled in enabledTypes", () => {
    const result = createDiscordWebhookSchema.safeParse({
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      enabledTypes: ["discord_webhook_disabled"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty enabledTypes array", () => {
    const result = createDiscordWebhookSchema.safeParse({
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      enabledTypes: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateDiscordWebhookSchema", () => {
  it("accepts partial update with only name", () => {
    const result = updateDiscordWebhookSchema.safeParse({ name: "New name" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only enabledTypes", () => {
    const result = updateDiscordWebhookSchema.safeParse({
      enabledTypes: ["member_added"],
    });
    expect(result.success).toBe(true);
  });
});

describe("maskWebhookUrl", () => {
  it("masks webhook URL showing only last 8 chars of token", () => {
    const masked = maskWebhookUrl("https://discord.com/api/webhooks/123456/abcdefghijklmnop");
    expect(masked).toBe("...ijklmnop");
    expect(masked).not.toContain("abcdefgh");
  });
});

describe("DISCORD_ENABLED_TYPES_DEFAULT", () => {
  it("does not include discord_webhook_disabled", () => {
    expect(DISCORD_ENABLED_TYPES_DEFAULT).not.toContain("discord_webhook_disabled");
  });
});
