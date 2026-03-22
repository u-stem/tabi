# Discord Webhook Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trip-level Discord Webhook notifications — trip events are sent as Discord Embed messages to a configured channel.

**Architecture:** Extend existing notification flow (`notifyTripMembersExcluding` / `notifyUsers`) to also send Discord Webhook requests. New `discord_webhooks` table (1:1 with trips), new API routes under `/api/trips/:id/discord-webhook`, new Discord Webhook dialog triggered from trip-actions.tsx.

**Tech Stack:** Hono (API), Drizzle ORM (DB), Zod (validation), React + shadcn/ui (frontend), Vitest (testing)

**Spec:** `docs/plans/discord-webhook-notifications.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `packages/shared/src/schemas/discord-webhook.ts` | Zod schemas + types (URL validation, enabledTypes, create/update) |
| `packages/shared/src/schemas/discord-webhook.test.ts` | Unit tests for schemas |
| `packages/shared/src/discord-embed.ts` | Discord Embed builder — notification payloads to Discord Embed objects |
| `packages/shared/src/discord-embed.test.ts` | Unit tests for Embed builder |
| `apps/api/src/lib/discord.ts` | Discord HTTP client — send Embed, handle errors/retry/deactivation |
| `apps/api/src/lib/discord.test.ts` | Unit tests for Discord client |
| `apps/api/src/routes/discord-webhook.ts` | API routes: GET/POST/PUT/DELETE + test send |
| `apps/api/src/routes/discord-webhook.test.ts` | Unit tests for API routes |
| `apps/web/components/discord-webhook-dialog.tsx` | Dialog for Webhook config (triggered from trip-actions) |

### Modified files

| File | Change |
|------|--------|
| `packages/shared/src/schemas/notification.ts` | Add `discord_webhook_disabled` to enum, defaults, labels, formatText |
| `packages/shared/src/messages.ts` | Add `discord_webhook_disabled` to PUSH_MSG |
| `packages/shared/src/schemas/index.ts` | Re-export discord-webhook schemas |
| `packages/shared/src/index.ts` | Re-export discord-embed |
| `apps/api/src/db/schema.ts` | Add `discordWebhooks` table + relations + enum value |
| `apps/api/src/app.ts` | Register discord-webhook routes |
| `apps/api/src/lib/notifications.ts` | Add Discord send in `notifyTripMembersExcluding` / `notifyUsers` (once per event, outside user loop) |
| `apps/web/components/trip-actions.tsx` | Add Discord Webhook menu item + dialog trigger |
| `apps/web/messages/ja.json` | Add `discord` i18n keys |
| `apps/web/messages/en.json` | Add `discord` i18n keys |
| `apps/api/src/db/seed-faqs.ts` | Add FAQ entries (JA + EN) |

---

## Task 1: Notification Type Enum Extension

**Files:**
- Modify: `packages/shared/src/schemas/notification.ts`
- Modify: `packages/shared/src/messages.ts`

- [ ] **Step 1: Add `discord_webhook_disabled` to notification type schema and defaults**

In `packages/shared/src/schemas/notification.ts`:
- Add `"discord_webhook_disabled"` to `notificationTypeSchema` enum values
- Add `discord_webhook_disabled: { inApp: true, push: true }` to `NOTIFICATION_DEFAULTS`
- Add `discord_webhook_disabled: "Discord通知が無効化された"` to `NOTIFICATION_TYPE_LABELS`
- Add case in `formatNotificationText`: `return \`「${payload.tripName}」のDiscord通知が無効化されました\``

In `packages/shared/src/messages.ts`:
- Add `discord_webhook_disabled: (p) => \`「${p.tripName}」のDiscord Webhookが無効化されました。設定を確認してください\`` to `PUSH_MSG`

- [ ] **Step 2: Run existing tests to verify nothing breaks**

Run: `bun run --filter @sugara/shared test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas/notification.ts packages/shared/src/messages.ts
git commit -m "feat: discord_webhook_disabled 通知タイプを追加"
```

---

## Task 2: Shared Zod Schemas

**Files:**
- Create: `packages/shared/src/schemas/discord-webhook.ts`
- Create: `packages/shared/src/schemas/discord-webhook.test.ts`
- Modify: `packages/shared/src/schemas/index.ts`

- [ ] **Step 1: Write failing tests for Discord Webhook schemas**

```typescript
// packages/shared/src/schemas/discord-webhook.test.ts
import { describe, expect, it } from "vitest";
import {
  discordWebhookUrlSchema,
  createDiscordWebhookSchema,
  updateDiscordWebhookSchema,
  maskWebhookUrl,
  DISCORD_ENABLED_TYPES_DEFAULT,
} from "./discord-webhook";

describe("discordWebhookUrlSchema", () => {
  it("accepts valid discord webhook URL", () => {
    const result = discordWebhookUrlSchema.safeParse(
      "https://discord.com/api/webhooks/123456/abcdef"
    );
    expect(result.success).toBe(true);
  });

  it("accepts discordapp.com webhook URL", () => {
    const result = discordWebhookUrlSchema.safeParse(
      "https://discordapp.com/api/webhooks/123456/abcdef"
    );
    expect(result.success).toBe(true);
  });

  it("rejects non-discord URL", () => {
    const result = discordWebhookUrlSchema.safeParse(
      "https://example.com/webhooks/123"
    );
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/shared test -- discord-webhook`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Discord Webhook schemas**

```typescript
// packages/shared/src/schemas/discord-webhook.ts
import { z } from "zod";
import { notificationTypeSchema } from "./notification";

// Notification types selectable for Discord (exclude discord_webhook_disabled)
const discordEnabledTypeValues = notificationTypeSchema.options.filter(
  (t) => t !== "discord_webhook_disabled"
);

export const discordEnabledTypeSchema = z.enum(
  discordEnabledTypeValues as [string, ...string[]]
);

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
    /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//,
    "Must be a Discord Webhook URL"
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
```

- [ ] **Step 4: Add re-export to `packages/shared/src/schemas/index.ts`**

```typescript
export * from "./discord-webhook";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run --filter @sugara/shared test -- discord-webhook`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schemas/discord-webhook.ts packages/shared/src/schemas/discord-webhook.test.ts packages/shared/src/schemas/index.ts
git commit -m "feat: Discord Webhook の共有 Zod スキーマを追加"
```

---

## Task 3: Discord Embed Builder

**Files:**
- Create: `packages/shared/src/discord-embed.ts`
- Create: `packages/shared/src/discord-embed.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing tests for Embed builder**

```typescript
// packages/shared/src/discord-embed.test.ts
import { describe, expect, it } from "vitest";
import { buildDiscordEmbed, DISCORD_EMBED_COLORS } from "./discord-embed";

describe("buildDiscordEmbed", () => {
  it("builds embed for member_added", () => {
    const embed = buildDiscordEmbed({
      type: "member_added",
      payload: { actorName: "Tanaka", tripName: "Tokyo Trip" },
      tripId: "trip-1",
      locale: "ja",
      baseUrl: "https://sugara.vercel.app",
    });

    expect(embed.color).toBe(DISCORD_EMBED_COLORS.member);
    expect(embed.author?.name).toBe("sugara");
    expect(embed.title).toBe("Tokyo Trip");
    expect(embed.description).toContain("Tanaka");
    expect(embed.url).toBe("https://sugara.vercel.app/trips/trip-1");
    expect(embed.timestamp).toBeDefined();
  });

  it("builds embed for schedule_created", () => {
    const embed = buildDiscordEmbed({
      type: "schedule_created",
      payload: { actorName: "Suzuki", tripName: "Osaka Trip", entityName: "Universal Studios" },
      tripId: "trip-2",
      locale: "ja",
      baseUrl: "https://sugara.vercel.app",
    });

    expect(embed.color).toBe(DISCORD_EMBED_COLORS.schedule);
    expect(embed.description).toContain("Suzuki");
    expect(embed.description).toContain("Universal Studios");
  });

  it("builds embed with English locale", () => {
    const embed = buildDiscordEmbed({
      type: "member_added",
      payload: { actorName: "Tanaka", tripName: "Tokyo Trip" },
      tripId: "trip-1",
      locale: "en",
      baseUrl: "https://sugara.vercel.app",
    });

    expect(embed.description).toContain("Tanaka");
  });

  it("builds embed for expense_added", () => {
    const embed = buildDiscordEmbed({
      type: "expense_added",
      payload: { actorName: "Yamada", tripName: "Kyoto Trip", entityName: "Dinner" },
      tripId: "trip-3",
      locale: "ja",
      baseUrl: "https://sugara.vercel.app",
    });

    expect(embed.color).toBe(DISCORD_EMBED_COLORS.expense);
  });

  it("builds embed for poll_started", () => {
    const embed = buildDiscordEmbed({
      type: "poll_started",
      payload: { tripName: "Summer Trip" },
      tripId: "trip-4",
      locale: "ja",
      baseUrl: "https://sugara.vercel.app",
    });

    expect(embed.color).toBe(DISCORD_EMBED_COLORS.poll);
  });

  it("falls back to English for unknown locale", () => {
    const embed = buildDiscordEmbed({
      type: "member_added",
      payload: { actorName: "Tanaka", tripName: "Trip" },
      tripId: "trip-1",
      locale: "fr",
      baseUrl: "https://sugara.vercel.app",
    });

    expect(embed.description).toContain("Tanaka");
  });
});

describe("DISCORD_EMBED_COLORS", () => {
  it("has all four categories", () => {
    expect(DISCORD_EMBED_COLORS).toHaveProperty("member");
    expect(DISCORD_EMBED_COLORS).toHaveProperty("schedule");
    expect(DISCORD_EMBED_COLORS).toHaveProperty("poll");
    expect(DISCORD_EMBED_COLORS).toHaveProperty("expense");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/shared test -- discord-embed`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Discord Embed builder**

```typescript
// packages/shared/src/discord-embed.ts
import type { NotificationType } from "./schemas/notification";

type NotificationPayload = {
  actorName?: string;
  tripName?: string;
  entityName?: string;
  newRole?: string;
  [key: string]: string | undefined;
};

export type DiscordEmbed = {
  author?: { name: string };
  title: string;
  description: string;
  url: string;
  color: number;
  timestamp: string;
};

export const DISCORD_EMBED_COLORS = {
  member: 0x3b82f6,
  schedule: 0x22c55e,
  poll: 0xf97316,
  expense: 0xa855f7,
} as const;

const COLOR_MAP: Record<string, number> = {
  member_added: DISCORD_EMBED_COLORS.member,
  member_removed: DISCORD_EMBED_COLORS.member,
  role_changed: DISCORD_EMBED_COLORS.member,
  schedule_created: DISCORD_EMBED_COLORS.schedule,
  schedule_updated: DISCORD_EMBED_COLORS.schedule,
  schedule_deleted: DISCORD_EMBED_COLORS.schedule,
  poll_started: DISCORD_EMBED_COLORS.poll,
  poll_closed: DISCORD_EMBED_COLORS.poll,
  expense_added: DISCORD_EMBED_COLORS.expense,
  settlement_checked: DISCORD_EMBED_COLORS.expense,
};

const DISCORD_MSG_JA: Record<string, (p: NotificationPayload) => string> = {
  member_added: (p) => `${p.actorName}さんが新しいメンバーを招待しました`,
  member_removed: (p) => `${p.actorName}さんがメンバーを削除しました`,
  role_changed: (p) => `${p.actorName}さんがロールを「${p.newRole}」に変更しました`,
  schedule_created: (p) => `${p.actorName}さんが予定「${p.entityName}」を追加しました`,
  schedule_updated: (p) => `${p.actorName}さんが予定「${p.entityName}」を更新しました`,
  schedule_deleted: (p) => `${p.actorName}さんが予定を削除しました`,
  poll_started: () => "日程調整が開始されました",
  poll_closed: () => "日程調整が終了しました",
  expense_added: (p) => `${p.actorName}さんが費用「${p.entityName}」を追加しました`,
  settlement_checked: (p) => `${p.actorName}さんが精算をチェックしました`,
};

const DISCORD_MSG_EN: Record<string, (p: NotificationPayload) => string> = {
  member_added: (p) => `${p.actorName} invited a new member`,
  member_removed: (p) => `${p.actorName} removed a member`,
  role_changed: (p) => `${p.actorName} changed a role to "${p.newRole}"`,
  schedule_created: (p) => `${p.actorName} added "${p.entityName}" to the schedule`,
  schedule_updated: (p) => `${p.actorName} updated "${p.entityName}"`,
  schedule_deleted: (p) => `${p.actorName} removed a schedule item`,
  poll_started: () => "A poll has started",
  poll_closed: () => "A poll has ended",
  expense_added: (p) => `${p.actorName} added expense "${p.entityName}"`,
  settlement_checked: (p) => `${p.actorName} checked a settlement`,
};

const DISCORD_MSG: Record<string, Record<string, (p: NotificationPayload) => string>> = {
  ja: DISCORD_MSG_JA,
  en: DISCORD_MSG_EN,
};

type BuildEmbedParams = {
  type: NotificationType;
  payload: NotificationPayload;
  tripId: string;
  locale: string;
  baseUrl: string;
};

export function buildDiscordEmbed(params: BuildEmbedParams): DiscordEmbed {
  const { type, payload, tripId, locale, baseUrl } = params;
  const messages = DISCORD_MSG[locale] ?? DISCORD_MSG.en;
  const formatter = messages[type];
  const description = formatter ? formatter(payload) : type;

  return {
    author: { name: "sugara" },
    title: payload.tripName ?? "Trip",
    description,
    url: `${baseUrl}/trips/${tripId}`,
    color: COLOR_MAP[type] ?? DISCORD_EMBED_COLORS.member,
    timestamp: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Add re-export to `packages/shared/src/index.ts`**

```typescript
export * from "./discord-embed";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run --filter @sugara/shared test -- discord-embed`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/discord-embed.ts packages/shared/src/discord-embed.test.ts packages/shared/src/index.ts
git commit -m "feat: Discord Embed ビルダーを追加"
```

---

## Task 4: DB Schema + Migration

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Add `discord_webhook_disabled` to `notificationTypeEnum` in schema.ts**

Add `"discord_webhook_disabled"` to the `notificationTypeEnum` pgEnum array.

- [ ] **Step 2: Add `discordWebhooks` table and relations**

```typescript
// In apps/api/src/db/schema.ts

export const discordWebhooks = pgTable("discord_webhooks", {
  id: uuid().primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" })
    .unique(),
  webhookUrl: text("webhook_url").notNull(),
  name: text("name").default(""),
  enabledTypes: jsonb("enabled_types").$type<string[]>().notNull(),
  locale: text("locale").notNull().default("ja"),
  isActive: boolean("is_active").notNull().default(true),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  failureCount: integer("failure_count").notNull().default(0),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const discordWebhooksRelations = relations(discordWebhooks, ({ one }) => ({
  trip: one(trips, { fields: [discordWebhooks.tripId], references: [trips.id] }),
  creator: one(users, { fields: [discordWebhooks.createdBy], references: [users.id] }),
}));
```

Also add `discordWebhook` to existing `tripsRelations`:
```typescript
discordWebhook: one(discordWebhooks),
```

- [ ] **Step 3: Generate migration**

Run: `bun run db:generate`
Expected: New migration file created in `apps/api/drizzle/`

- [ ] **Step 4: Run migration on local DB**

Run: `bun run db:migrate`
Expected: Migration applied successfully

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat: discord_webhooks テーブルと discord_webhook_disabled 通知タイプを追加"
```

---

## Task 5: Discord HTTP Client

**Files:**
- Create: `apps/api/src/lib/discord.ts`
- Create: `apps/api/src/lib/discord.test.ts`

- [ ] **Step 1: Write failing tests for Discord client**

```typescript
// apps/api/src/lib/discord.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockDbUpdate = vi.fn();
const mockDbQueryDiscordWebhooks = { findFirst: vi.fn() };
vi.mock("../db/index", () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    query: { discordWebhooks: mockDbQueryDiscordWebhooks },
  },
}));

vi.mock("./logger", () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock("./notifications", () => ({
  notifyUsers: vi.fn(),
}));

import { sendDiscordWebhook, validateWebhookUrl } from "./discord";

describe("validateWebhookUrl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true for valid webhook URL", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await validateWebhookUrl("https://discord.com/api/webhooks/123/abc");
    expect(result).toBe(true);
  });

  it("returns false for invalid webhook URL", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await validateWebhookUrl("https://discord.com/api/webhooks/invalid/invalid");
    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const result = await validateWebhookUrl("https://discord.com/api/webhooks/123/abc");
    expect(result).toBe(false);
  });
});

describe("sendDiscordWebhook", () => {
  const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnValue({ set: mockSet });
  });

  it("sends embed and updates lastSuccessAt on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await sendDiscordWebhook({
      webhookId: "wh-1",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      embed: { title: "Test", description: "Test", url: "", color: 0, timestamp: "" },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/123/abc",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("deactivates webhook on 404 response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    mockDbQueryDiscordWebhooks.findFirst.mockResolvedValue({ tripId: "trip-1", createdBy: "user-1" });

    await sendDiscordWebhook({
      webhookId: "wh-1",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      embed: { title: "Test", description: "Test", url: "", color: 0, timestamp: "" },
    });

    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("retries once on 5xx then increments failureCount", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    await sendDiscordWebhook({
      webhookId: "wh-1",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      embed: { title: "Test", description: "Test", url: "", color: 0, timestamp: "" },
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- discord.test`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Discord client**

```typescript
// apps/api/src/lib/discord.ts
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { discordWebhooks } from "../db/schema";
import { logger } from "./logger";
import { notifyUsers } from "./notifications";
import type { DiscordEmbed } from "@sugara/shared";

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
      // retry failed, fall through
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --filter @sugara/api test -- discord.test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/discord.ts apps/api/src/lib/discord.test.ts
git commit -m "feat: Discord Webhook HTTP クライアントを追加"
```

---

## Task 6: Integrate Discord Send into Notification Flow

**Files:**
- Modify: `apps/api/src/lib/notifications.ts`

**Important:** Discord send must happen once per event, NOT once per user. The send should be in `notifyTripMembersExcluding` and `notifyUsers` — outside the per-user notification loop.

- [ ] **Step 1: Read `notifications.ts` to find exact integration points**

Read `apps/api/src/lib/notifications.ts` and identify:
- Where `notifyTripMembersExcluding` iterates over users
- Where `notifyUsers` iterates over users
- The fire-and-forget pattern (`void (async () => { ... })()`)

- [ ] **Step 2: Add `sendDiscordForTrip` function and call from both notification functions**

Add a new function `sendDiscordForTrip` and call it once in each of `notifyTripMembersExcluding` and `notifyUsers`, alongside (not inside) the per-user loop:

```typescript
import { eq } from "drizzle-orm";
import { discordWebhooks } from "../db/schema";
import { sendDiscordWebhook } from "./discord";
import { buildDiscordEmbed } from "@sugara/shared";
import { env } from "./env";

// Called once per event from notifyTripMembersExcluding / notifyUsers
async function sendDiscordForTrip(params: {
  type: NotificationType;
  tripId: string;
  payload: NotificationPayload;
}): Promise<void> {
  try {
    const webhook = await db.query.discordWebhooks.findFirst({
      where: eq(discordWebhooks.tripId, params.tripId),
    });

    if (!webhook || !webhook.isActive) return;

    const enabledTypes = webhook.enabledTypes as string[];
    if (!enabledTypes.includes(params.type)) return;

    const embed = buildDiscordEmbed({
      type: params.type,
      payload: params.payload,
      tripId: params.tripId,
      locale: webhook.locale,
      baseUrl: env.FRONTEND_URL,
    });

    await sendDiscordWebhook({
      webhookId: webhook.id,
      webhookUrl: webhook.webhookUrl,
      embed,
    });
  } catch (err) {
    logger.error({ err, tripId: params.tripId }, "Failed to send Discord notification");
  }
}
```

In `notifyTripMembersExcluding`, add after retrieving trip data:
```typescript
// Send Discord webhook (once per event, outside user loop)
void sendDiscordForTrip({ type, tripId, payload: makePayload(tripName) });
```

In `notifyUsers`, add similarly:
```typescript
void sendDiscordForTrip({ type, tripId, payload: makePayload(tripName) });
```

- [ ] **Step 3: Run all tests to verify nothing breaks**

Run: `bun run --filter @sugara/api test`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/notifications.ts
git commit -m "feat: 通知フローに Discord Webhook 送信を統合"
```

---

## Task 7: API Routes

**Files:**
- Create: `apps/api/src/routes/discord-webhook.ts`
- Create: `apps/api/src/routes/discord-webhook.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write failing tests for API routes**

```typescript
// apps/api/src/routes/discord-webhook.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    tripMembers: { findFirst: vi.fn() },
    discordWebhooks: { findFirst: vi.fn() },
  },
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
}));

const mockValidateWebhookUrl = vi.fn();
const mockSendDiscordWebhook = vi.fn();

vi.mock("../lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));
vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));
vi.mock("../lib/discord", () => ({
  validateWebhookUrl: (...args: unknown[]) => mockValidateWebhookUrl(...args),
  sendDiscordWebhook: (...args: unknown[]) => mockSendDiscordWebhook(...args),
}));
vi.mock("../lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));

import { Hono } from "hono";
import { discordWebhookRoutes } from "./discord-webhook";

function createTestApp() {
  const app = new Hono();
  app.route("/api/trips", discordWebhookRoutes);
  return app;
}

const TRIP_ID = "trip-1";
const USER = { id: "user-1", name: "Test User" };
const WEBHOOK_URL = "https://discord.com/api/webhooks/123456/abcdef";

describe("POST /api/trips/:tripId/discord-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: USER, session: { id: "s-1" } });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({ tripId: TRIP_ID, userId: USER.id, role: "owner" });
  });

  it("returns 201 when webhook is created", async () => {
    mockDbQuery.discordWebhooks.findFirst.mockResolvedValue(null);
    mockValidateWebhookUrl.mockResolvedValue(true);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "wh-1", tripId: TRIP_ID, webhookUrl: WEBHOOK_URL,
          name: "", enabledTypes: ["member_added"], isActive: true,
        }]),
      }),
    });

    const app = createTestApp();
    const res = await app.request(`/api/trips/${TRIP_ID}/discord-webhook`, {
      method: "POST",
      body: JSON.stringify({ webhookUrl: WEBHOOK_URL, enabledTypes: ["member_added"] }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(201);
  });

  it("returns 400 for invalid webhook URL", async () => {
    const app = createTestApp();
    const res = await app.request(`/api/trips/${TRIP_ID}/discord-webhook`, {
      method: "POST",
      body: JSON.stringify({ webhookUrl: "https://example.com", enabledTypes: ["member_added"] }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
  });

  it("returns 409 when webhook already exists", async () => {
    mockDbQuery.discordWebhooks.findFirst.mockResolvedValue({ id: "wh-existing" });
    mockValidateWebhookUrl.mockResolvedValue(true);

    const app = createTestApp();
    const res = await app.request(`/api/trips/${TRIP_ID}/discord-webhook`, {
      method: "POST",
      body: JSON.stringify({ webhookUrl: WEBHOOK_URL, enabledTypes: ["member_added"] }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(409);
  });

  it("returns 404 for viewer role", async () => {
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({ tripId: TRIP_ID, userId: USER.id, role: "viewer" });

    const app = createTestApp();
    const res = await app.request(`/api/trips/${TRIP_ID}/discord-webhook`, {
      method: "POST",
      body: JSON.stringify({ webhookUrl: WEBHOOK_URL, enabledTypes: ["member_added"] }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/trips/:tripId/discord-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: USER, session: { id: "s-1" } });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({ tripId: TRIP_ID, userId: USER.id, role: "viewer" });
  });

  it("returns masked webhook URL", async () => {
    mockDbQuery.discordWebhooks.findFirst.mockResolvedValue({
      id: "wh-1", tripId: TRIP_ID, webhookUrl: WEBHOOK_URL,
      name: "Test", enabledTypes: ["member_added"], isActive: true,
      lastSuccessAt: null, failureCount: 0,
    });

    const app = createTestApp();
    const res = await app.request(`/api/trips/${TRIP_ID}/discord-webhook`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.webhookUrl).not.toBe(WEBHOOK_URL);
    expect(data.webhookUrl).toContain("...");
  });

  it("returns null when no webhook configured", async () => {
    mockDbQuery.discordWebhooks.findFirst.mockResolvedValue(null);

    const app = createTestApp();
    const res = await app.request(`/api/trips/${TRIP_ID}/discord-webhook`);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeNull();
  });
});

describe("DELETE /api/trips/:tripId/discord-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: USER, session: { id: "s-1" } });
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({ tripId: TRIP_ID, userId: USER.id, role: "editor" });
  });

  it("returns 200 when webhook is deleted", async () => {
    mockDbQuery.discordWebhooks.findFirst.mockResolvedValue({ id: "wh-1", tripId: TRIP_ID });
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });

    const app = createTestApp();
    const res = await app.request(`/api/trips/${TRIP_ID}/discord-webhook`, { method: "DELETE" });

    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- discord-webhook.test`
Expected: FAIL — module not found

- [ ] **Step 3: Implement API routes**

```typescript
// apps/api/src/routes/discord-webhook.ts
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { discordWebhooks } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import { validateWebhookUrl, sendDiscordWebhook } from "../lib/discord";
import {
  createDiscordWebhookSchema,
  updateDiscordWebhookSchema,
  maskWebhookUrl,
  buildDiscordEmbed,
} from "@sugara/shared";
import { logger } from "../lib/logger";
import { env } from "../lib/env";
import type { AppEnv } from "../types";

export const discordWebhookRoutes = new Hono<AppEnv>();

discordWebhookRoutes.use("*", requireAuth);

// GET /:tripId/discord-webhook
discordWebhookRoutes.get("/:tripId/discord-webhook", requireTripAccess("viewer"), async (c) => {
  const tripId = c.req.param("tripId");
  const webhook = await db.query.discordWebhooks.findFirst({
    where: eq(discordWebhooks.tripId, tripId),
  });

  if (!webhook) return c.json(null);

  return c.json({
    id: webhook.id,
    name: webhook.name,
    webhookUrl: maskWebhookUrl(webhook.webhookUrl),
    enabledTypes: webhook.enabledTypes,
    isActive: webhook.isActive,
    lastSuccessAt: webhook.lastSuccessAt,
    failureCount: webhook.failureCount,
  });
});

// POST /:tripId/discord-webhook
discordWebhookRoutes.post("/:tripId/discord-webhook", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const body = await c.req.json();
  const parsed = createDiscordWebhookSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const existing = await db.query.discordWebhooks.findFirst({
    where: eq(discordWebhooks.tripId, tripId),
  });
  if (existing) return c.json({ error: "Webhook already configured for this trip" }, 409);

  const isValid = await validateWebhookUrl(parsed.data.webhookUrl);
  if (!isValid) return c.json({ error: "Invalid or unreachable Discord Webhook URL" }, 400);

  const [webhook] = await db
    .insert(discordWebhooks)
    .values({
      tripId,
      webhookUrl: parsed.data.webhookUrl,
      name: parsed.data.name ?? "",
      enabledTypes: parsed.data.enabledTypes,
      locale: parsed.data.locale,
      createdBy: user.id,
    })
    .returning();

  return c.json({
    id: webhook.id,
    name: webhook.name,
    webhookUrl: maskWebhookUrl(webhook.webhookUrl),
    enabledTypes: webhook.enabledTypes,
    isActive: webhook.isActive,
  }, 201);
});

// PUT /:tripId/discord-webhook
discordWebhookRoutes.put("/:tripId/discord-webhook", requireTripAccess("editor"), async (c) => {
  const tripId = c.req.param("tripId");

  const body = await c.req.json();
  const parsed = updateDiscordWebhookSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const existing = await db.query.discordWebhooks.findFirst({
    where: eq(discordWebhooks.tripId, tripId),
  });
  if (!existing) return c.json({ error: "No webhook configured" }, 404);

  if (parsed.data.webhookUrl) {
    const isValid = await validateWebhookUrl(parsed.data.webhookUrl);
    if (!isValid) return c.json({ error: "Invalid or unreachable Discord Webhook URL" }, 400);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.webhookUrl) {
    updateData.webhookUrl = parsed.data.webhookUrl;
    updateData.isActive = true;
    updateData.failureCount = 0;
  }
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.enabledTypes) updateData.enabledTypes = parsed.data.enabledTypes;
  if (parsed.data.locale) updateData.locale = parsed.data.locale;

  const [updated] = await db
    .update(discordWebhooks)
    .set(updateData)
    .where(eq(discordWebhooks.id, existing.id))
    .returning();

  return c.json({
    id: updated.id,
    name: updated.name,
    webhookUrl: maskWebhookUrl(updated.webhookUrl),
    enabledTypes: updated.enabledTypes,
    isActive: updated.isActive,
  });
});

// DELETE /:tripId/discord-webhook
discordWebhookRoutes.delete("/:tripId/discord-webhook", requireTripAccess("editor"), async (c) => {
  const tripId = c.req.param("tripId");

  const existing = await db.query.discordWebhooks.findFirst({
    where: eq(discordWebhooks.tripId, tripId),
  });
  if (!existing) return c.json({ error: "No webhook configured" }, 404);

  await db.delete(discordWebhooks).where(eq(discordWebhooks.id, existing.id));

  return c.json({ ok: true });
});

// POST /:tripId/discord-webhook/test
discordWebhookRoutes.post("/:tripId/discord-webhook/test", requireTripAccess("editor"), async (c) => {
  const tripId = c.req.param("tripId");

  const webhook = await db.query.discordWebhooks.findFirst({
    where: eq(discordWebhooks.tripId, tripId),
  });
  if (!webhook) return c.json({ error: "No webhook configured" }, 404);

  const embed = buildDiscordEmbed({
    type: "member_added",
    payload: { actorName: "sugara", tripName: "Test Notification" },
    tripId,
    locale: webhook.locale,
    baseUrl: env.FRONTEND_URL,
  });

  await sendDiscordWebhook({
    webhookId: webhook.id,
    webhookUrl: webhook.webhookUrl,
    embed,
  });

  return c.json({ ok: true });
});
```

- [ ] **Step 4: Register routes in app.ts**

In `apps/api/src/app.ts`, add:
```typescript
import { discordWebhookRoutes } from "./routes/discord-webhook";

// Add alongside existing trip sub-routes
app.route("/api/trips", discordWebhookRoutes);
```

Check existing patterns in app.ts — trip sub-routes (members, schedules, etc.) may be registered differently. Follow the same pattern.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run --filter @sugara/api test -- discord-webhook.test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/discord-webhook.ts apps/api/src/routes/discord-webhook.test.ts apps/api/src/app.ts
git commit -m "feat: Discord Webhook の CRUD API ルートを追加"
```

---

## Task 8: Frontend — Discord Webhook Dialog + i18n

**Files:**
- Create: `apps/web/components/discord-webhook-dialog.tsx`
- Modify: `apps/web/components/trip-actions.tsx`
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Add i18n keys to ja.json and en.json**

Add `"discord"` key to `apps/web/messages/ja.json`:

```json
{
  "discord": {
    "title": "Discord通知",
    "description": "旅行のイベントをDiscordチャンネルに通知します",
    "setup": "Discord通知を設定",
    "webhookUrl": "Webhook URL",
    "webhookUrlPlaceholder": "https://discord.com/api/webhooks/...",
    "webhookUrlHelp": "Discordのチャンネル設定 > 連携サービス > ウェブフック から取得できます",
    "name": "表示名",
    "namePlaceholder": "旅行通知",
    "enabledTypes": "通知するイベント",
    "save": "保存",
    "delete": "削除",
    "deleteConfirm": "Discord通知の設定を削除しますか？",
    "testSend": "テスト送信",
    "testSendSuccess": "テスト通知を送信しました",
    "active": "有効",
    "inactive": "無効",
    "inactiveWarning": "Webhookが無効化されています。URLを確認して再設定してください",
    "reactivate": "再設定",
    "lastSuccess": "最終送信成功",
    "created": "Discord通知を設定しました",
    "updated": "Discord通知を更新しました",
    "deleted": "Discord通知を削除しました",
    "invalidUrl": "Discord Webhook URLを入力してください",
    "unreachableUrl": "Webhook URLに接続できません",
    "alreadyExists": "この旅行にはすでにWebhookが設定されています"
  }
}
```

Add equivalent `"discord"` key to `apps/web/messages/en.json`:

```json
{
  "discord": {
    "title": "Discord Notifications",
    "description": "Send trip events to a Discord channel",
    "setup": "Set up Discord notifications",
    "webhookUrl": "Webhook URL",
    "webhookUrlPlaceholder": "https://discord.com/api/webhooks/...",
    "webhookUrlHelp": "Get this from Discord channel settings > Integrations > Webhooks",
    "name": "Display name",
    "namePlaceholder": "Trip notifications",
    "enabledTypes": "Events to notify",
    "save": "Save",
    "delete": "Delete",
    "deleteConfirm": "Delete Discord notification settings?",
    "testSend": "Send test",
    "testSendSuccess": "Test notification sent",
    "active": "Active",
    "inactive": "Inactive",
    "inactiveWarning": "Webhook has been deactivated. Please check the URL and reconfigure",
    "reactivate": "Reconfigure",
    "lastSuccess": "Last successful send",
    "created": "Discord notifications configured",
    "updated": "Discord notifications updated",
    "deleted": "Discord notifications deleted",
    "invalidUrl": "Please enter a Discord Webhook URL",
    "unreachableUrl": "Cannot connect to Webhook URL",
    "alreadyExists": "A webhook is already configured for this trip"
  }
}
```

- [ ] **Step 2: Create Discord Webhook dialog component**

Create `apps/web/components/discord-webhook-dialog.tsx`.

This component should:
- Accept `tripId` and `open`/`onOpenChange` props (Dialog pattern)
- Fetch current webhook config via `GET /api/trips/:id/discord-webhook` using existing data fetching pattern (check trip-actions.tsx or member-dialog.tsx for the pattern — likely SWR or React Query)
- **No webhook exists:** Show form with URL input + name input + enabledTypes checkboxes
- **Webhook exists:** Show masked URL, status badge (active/inactive), enabledTypes toggles, test/delete buttons
- **Inactive webhook:** Show warning banner + reactivate button (re-enter URL via PUT)
- Use `api()` from `apps/web/lib/api.ts` for all API calls
- Use `useTranslations("discord")` for i18n
- Use shadcn/ui components: Dialog, Input, Button, Switch, Label, Badge, Alert
- Follow existing dialog patterns (member-dialog.tsx, share-dialog.tsx)

- [ ] **Step 3: Add Discord Webhook trigger to trip-actions.tsx**

In `apps/web/components/trip-actions.tsx`:
- Add a menu item for Discord Webhook (only visible for owner/editor roles)
- Add state for dialog open/close
- Dynamically import the dialog component (follow existing pattern with `MemberDialog` / `ShareDialog`)

- [ ] **Step 4: Verify the UI works**

Run: `bun run --filter @sugara/web dev`
Navigate to a trip, open the actions menu, click Discord notification item, verify dialog opens.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/discord-webhook-dialog.tsx apps/web/components/trip-actions.tsx apps/web/messages/ja.json apps/web/messages/en.json
git commit -m "feat: Discord Webhook 設定ダイアログを追加"
```

---

## Task 9: FAQ + News + Final Verification

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`
- Create: `apps/web/content/news/ja/2026-03-22-discord-notifications.md`
- Create: `apps/web/content/news/en/2026-03-22-discord-notifications.md`

- [ ] **Step 1: Add FAQ entries to seed-faqs.ts**

Add to `JA_FAQS`:
```typescript
{ question: "旅行のイベントをDiscordに通知するには？", answer: "旅行のメニューから「Discord通知」を選び、DiscordのWebhook URLを設定してください。通知するイベントの種類も選択できます。" },
{ question: "Discord通知が届かなくなった場合は？", answer: "Webhook URLが無効になると自動的に通知が停止します。旅行のメニューからDiscord通知の状態を確認し、必要に応じてURLを再設定してください。" },
```

Add to `EN_FAQS`:
```typescript
{ question: "How do I send trip events to Discord?", answer: "Open the trip menu, select 'Discord Notifications', and configure a Discord Webhook URL. You can also select which event types to send." },
{ question: "What if Discord notifications stop working?", answer: "If the Webhook URL becomes invalid, notifications are automatically paused. Check the Discord notification settings from the trip menu and reconfigure the URL if needed." },
```

Set appropriate `sortOrder` values following existing patterns.

- [ ] **Step 2: Create news articles**

Create `apps/web/content/news/ja/2026-03-22-discord-notifications.md` and `apps/web/content/news/en/2026-03-22-discord-notifications.md` following existing article format in that directory.

- [ ] **Step 3: Seed FAQs locally**

Run: `bun run --filter @sugara/api db:seed-faqs`
Expected: FAQs seeded successfully

- [ ] **Step 4: Run full type check**

Run: `bun run check-types`
Expected: No type errors

- [ ] **Step 5: Run lint + format**

Run: `bun run check`
Expected: No lint/format errors

- [ ] **Step 6: Run all tests**

Run: `bun run test`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/seed-faqs.ts apps/web/content/news/
git commit -m "docs: Discord 通知の FAQ とお知らせ記事を追加"
```

- [ ] **Step 8: Clean up plan document**

Delete `docs/plans/discord-webhook-notifications.md` and `docs/plans/discord-webhook-notifications-plan.md` (completed plans live in git history per CLAUDE.md convention).

```bash
git rm docs/plans/discord-webhook-notifications.md docs/plans/discord-webhook-notifications-plan.md
git commit -m "chore: 完了した計画ドキュメントを削除"
```

---

## Task Dependencies

| Task | Description | Depends On |
|------|------------|------------|
| 1 | Notification type enum extension | — |
| 2 | Shared Zod schemas | 1 (needs `discord_webhook_disabled` in enum) |
| 3 | Discord Embed builder | 1 |
| 4 | DB schema + migration | 1 |
| 5 | Discord HTTP client | 3, 4 |
| 6 | Notification flow integration | 5 |
| 7 | API routes | 2, 4, 5 |
| 8 | Frontend UI | 2, 7 |
| 9 | FAQ + News + verification | All |

**Parallelizable:** Tasks 2, 3, 4 can run in parallel (all depend only on Task 1). Tasks 6 and 7 can run in parallel after Task 5.
