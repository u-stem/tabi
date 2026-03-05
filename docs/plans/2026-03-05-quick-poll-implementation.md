# Quick Poll Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 旅行に紐づかない独立した投票機能を追加する。リンク共有で匿名参加でき、リアルタイムで結果が更新される。

**Architecture:** 3テーブル (quick_polls, quick_poll_options, quick_poll_votes) + 管理系API (認証必須) + 共有系API (認証不要) + Supabase Realtime Broadcast。フロントエンドは `/p/:shareToken` (投票参加), `/polls/new` (作成), `/polls` (一覧) の3ページ。

**Tech Stack:** Hono API, Drizzle ORM, Zod, Supabase Realtime Broadcast, React Query, shadcn/ui

---

## Task 1: Shared Schemas + Limits

**Files:**
- Create: `packages/shared/src/schemas/quick-poll.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/limits.ts`
- Modify: `packages/shared/src/messages.ts`

**Step 1: Create shared schema**

```typescript
// packages/shared/src/schemas/quick-poll.ts
import { z } from "zod";
import {
  MAX_OPTIONS_PER_QUICK_POLL,
  MIN_OPTIONS_PER_QUICK_POLL,
  QUICK_POLL_OPTION_MAX_LENGTH,
  QUICK_POLL_QUESTION_MAX_LENGTH,
} from "../limits";

export const quickPollStatusSchema = z.enum(["open", "closed"]);
export type QuickPollStatus = z.infer<typeof quickPollStatusSchema>;

export const createQuickPollSchema = z.object({
  question: z.string().min(1).max(QUICK_POLL_QUESTION_MAX_LENGTH),
  options: z
    .array(z.object({ label: z.string().min(1).max(QUICK_POLL_OPTION_MAX_LENGTH) }))
    .min(MIN_OPTIONS_PER_QUICK_POLL)
    .max(MAX_OPTIONS_PER_QUICK_POLL),
  allowMultiple: z.boolean().optional().default(false),
  showResultsBeforeVote: z.boolean().optional().default(true),
});

export const updateQuickPollSchema = z.object({
  status: z.literal("closed").optional(),
});

export const quickPollVoteSchema = z.object({
  optionIds: z.array(z.string().uuid()).min(1),
  anonymousId: z.string().uuid().optional(),
});

export const quickPollDeleteVoteSchema = z.object({
  anonymousId: z.string().uuid().optional(),
});

// Response type for shared poll endpoint
export type QuickPollResponse = {
  id: string;
  question: string;
  allowMultiple: boolean;
  showResultsBeforeVote: boolean;
  status: QuickPollStatus;
  creatorId: string;
  expiresAt: string;
  createdAt: string;
  options: {
    id: string;
    label: string;
    sortOrder: number;
    voteCount: number;
  }[];
  totalVotes: number;
  myVoteOptionIds: string[];
};
```

**Step 2: Add limits**

Add to `packages/shared/src/limits.ts`:

```typescript
export const QUICK_POLL_QUESTION_MAX_LENGTH = 200;
export const QUICK_POLL_OPTION_MAX_LENGTH = 100;
export const MAX_OPTIONS_PER_QUICK_POLL = 10;
export const MIN_OPTIONS_PER_QUICK_POLL = 2;
export const MAX_QUICK_POLLS_PER_USER = 20;
```

**Step 3: Add messages**

Add to `ERROR_MSG` in `packages/shared/src/messages.ts`:

```typescript
QUICK_POLL_NOT_FOUND: "Quick poll not found",
QUICK_POLL_NOT_OPEN: "Quick poll is not open",
QUICK_POLL_ALREADY_VOTED: "Already voted",
QUICK_POLL_SINGLE_VOTE_ONLY: "Only one option allowed",
QUICK_POLL_INVALID_OPTION: "Some options do not belong to this poll",
LIMIT_QUICK_POLLS: "Quick poll limit reached",
```

Add to `MSG` in `packages/shared/src/messages.ts`:

```typescript
// Quick Poll
QUICK_POLL_CREATED: "投票を作成しました",
QUICK_POLL_CREATE_FAILED: "投票の作成に失敗しました",
QUICK_POLL_CLOSED: "投票を終了しました",
QUICK_POLL_CLOSE_FAILED: "投票の終了に失敗しました",
QUICK_POLL_DELETED: "投票を削除しました",
QUICK_POLL_DELETE_FAILED: "投票の削除に失敗しました",
QUICK_POLL_VOTED: "投票しました",
QUICK_POLL_VOTE_FAILED: "投票に失敗しました",
QUICK_POLL_VOTE_CANCELLED: "投票を取り消しました",
QUICK_POLL_VOTE_CANCEL_FAILED: "投票の取り消しに失敗しました",
QUICK_POLL_LINK_COPIED: "投票リンクをコピーしました",
QUICK_POLL_NOT_FOUND: "この投票は存在しないか、有効期限が切れています",
QUICK_POLL_FETCH_FAILED: "投票の取得に失敗しました",
EMPTY_QUICK_POLL: "投票がありません",
LIMIT_QUICK_POLLS: `投票は最大${MAX_QUICK_POLLS_PER_USER}件まで作成できます`,
```

**Step 4: Export from index**

Add to `packages/shared/src/schemas/index.ts`:

```typescript
export * from "./quick-poll";
```

**Step 5: Verify build**

Run: `bun run --filter @sugara/shared check-types`
Expected: PASS

**Step 6: Commit**

```
feat: Quick Poll 共有スキーマとリミットを追加
```

---

## Task 2: DB Schema + Migration

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: Add enum and tables**

Add `quickPollStatusEnum` near the other enums (after line 73):

```typescript
export const quickPollStatusEnum = pgEnum("quick_poll_status", ["open", "closed"]);
```

Add tables after `faqs` table (end of file, before any trailing content):

```typescript
export const quickPolls = pgTable(
  "quick_polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shareToken: varchar("share_token", { length: 64 }).notNull().unique(),
    question: text("question").notNull(),
    allowMultiple: boolean("allow_multiple").notNull().default(false),
    showResultsBeforeVote: boolean("show_results_before_vote").notNull().default(true),
    status: quickPollStatusEnum("status").notNull().default("open"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quick_polls_creator_id_idx").on(table.creatorId),
    index("quick_polls_expires_at_idx").on(table.expiresAt),
  ],
).enableRLS();

export const quickPollOptions = pgTable(
  "quick_poll_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => quickPolls.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("quick_poll_options_poll_id_idx").on(table.pollId)],
).enableRLS();

export const quickPollVotes = pgTable(
  "quick_poll_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => quickPolls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => quickPollOptions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonymousId: text("anonymous_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quick_poll_votes_poll_id_idx").on(table.pollId),
    uniqueIndex("quick_poll_votes_option_user_idx")
      .on(table.pollId, table.optionId, table.userId)
      .where(sql`user_id IS NOT NULL`),
    uniqueIndex("quick_poll_votes_option_anonymous_idx")
      .on(table.pollId, table.optionId, table.anonymousId)
      .where(sql`anonymous_id IS NOT NULL`),
    check(
      "quick_poll_votes_user_or_anonymous",
      sql`user_id IS NOT NULL OR anonymous_id IS NOT NULL`,
    ),
  ],
).enableRLS();

export const quickPollsRelations = relations(quickPolls, ({ one, many }) => ({
  creator: one(users, { fields: [quickPolls.creatorId], references: [users.id] }),
  options: many(quickPollOptions),
  votes: many(quickPollVotes),
}));

export const quickPollOptionsRelations = relations(quickPollOptions, ({ one, many }) => ({
  poll: one(quickPolls, { fields: [quickPollOptions.pollId], references: [quickPolls.id] }),
  votes: many(quickPollVotes),
}));

export const quickPollVotesRelations = relations(quickPollVotes, ({ one }) => ({
  poll: one(quickPolls, { fields: [quickPollVotes.pollId], references: [quickPolls.id] }),
  option: one(quickPollOptions, {
    fields: [quickPollVotes.optionId],
    references: [quickPollOptions.id],
  }),
  user: one(users, { fields: [quickPollVotes.userId], references: [users.id] }),
}));
```

**Step 2: Generate migration**

Run: `bun run db:generate`
Expected: New migration file generated in `apps/api/drizzle/`

**Step 3: Run migration**

Run: `bun run db:migrate`
Expected: Migration applied successfully

**Step 4: Verify build**

Run: `bun run --filter @sugara/api check-types`
Expected: PASS

**Step 5: Commit**

```
feat: Quick Poll DBスキーマとマイグレーションを追加
```

---

## Task 3: API Tests - CRUD

**Files:**
- Create: `apps/api/src/__tests__/quick-polls.test.ts`

**Step 1: Write failing tests for CRUD operations**

```typescript
// apps/api/src/__tests__/quick-polls.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, TEST_USER } from "./test-helpers";

const {
  mockGetSession,
  mockDbQuery,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockDbSelect,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    quickPolls: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    quickPollOptions: {
      findMany: vi.fn(),
    },
    quickPollVotes: {
      findMany: vi.fn(),
    },
  },
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../db/index", () => {
  const tx = {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  };
  return {
    db: { ...tx, transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
  };
});

import { quickPollRoutes } from "../routes/quick-polls";

const fakeUser = TEST_USER;
const app = createTestApp(quickPollRoutes, "/api/quick-polls");

describe("Quick Poll routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
  });

  describe("POST /api/quick-polls", () => {
    it("should create a poll with options", async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: "poll-1", shareToken: "abc123" }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDbInsert.mockReturnValue({ values: mockValues });

      const res = await app.request("/api/quick-polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Sushi or Ramen?",
          options: [{ label: "Sushi" }, { label: "Ramen" }],
        }),
      });

      expect(res.status).toBe(201);
    });

    it("should reject with less than 2 options", async () => {
      const res = await app.request("/api/quick-polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Only one?",
          options: [{ label: "Solo" }],
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should return 401 without auth", async () => {
      mockGetSession.mockResolvedValue(null);

      const res = await app.request("/api/quick-polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Q?",
          options: [{ label: "A" }, { label: "B" }],
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/quick-polls", () => {
    it("should return user's polls", async () => {
      mockDbQuery.quickPolls.findMany.mockResolvedValue([
        {
          id: "poll-1",
          question: "A or B?",
          status: "open",
          shareToken: "abc",
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          options: [{ id: "o1", label: "A", sortOrder: 0 }],
          votes: [],
        },
      ]);

      const res = await app.request("/api/quick-polls");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
    });
  });

  describe("PATCH /api/quick-polls/:id", () => {
    it("should close a poll", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue({
        id: "poll-1",
        creatorId: fakeUser.id,
        status: "open",
      });
      const mockReturning = vi.fn().mockResolvedValue([{ id: "poll-1" }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockDbUpdate.mockReturnValue({ set: mockSet });

      const res = await app.request("/api/quick-polls/poll-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });

      expect(res.status).toBe(200);
    });

    it("should reject non-creator", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue({
        id: "poll-1",
        creatorId: "other-user",
        status: "open",
      });

      const res = await app.request("/api/quick-polls/poll-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/quick-polls/:id", () => {
    it("should delete creator's poll", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue({
        id: "poll-1",
        creatorId: fakeUser.id,
      });
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      mockDbDelete.mockReturnValue({ where: mockWhere });

      const res = await app.request("/api/quick-polls/poll-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- --run apps/api/src/__tests__/quick-polls.test.ts`
Expected: FAIL (routes module not found)

---

## Task 4: API Routes - CRUD

**Files:**
- Create: `apps/api/src/routes/quick-polls.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Implement CRUD routes**

```typescript
// apps/api/src/routes/quick-polls.ts
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { quickPollOptions, quickPolls, quickPollVotes } from "../db/schema";
import { ERROR_MSG, SEVEN_DAYS_MS } from "../lib/constants";
import { generateShareToken } from "../lib/share-token";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";
import {
  createQuickPollSchema,
  MAX_QUICK_POLLS_PER_USER,
  updateQuickPollSchema,
} from "@sugara/shared";

const quickPollRoutes = new Hono<AppEnv>();
quickPollRoutes.use("*", requireAuth);

// Create
quickPollRoutes.post("/", async (c) => {
  const user = c.get("user");
  const parsed = createQuickPollSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { question, options, allowMultiple, showResultsBeforeVote } = parsed.data;

  // Check limit
  const existing = await db.query.quickPolls.findMany({
    where: eq(quickPolls.creatorId, user.id),
    columns: { id: true },
  });
  if (existing.length >= MAX_QUICK_POLLS_PER_USER) {
    return c.json({ error: ERROR_MSG.LIMIT_QUICK_POLLS }, 409);
  }

  const [poll] = await db
    .insert(quickPolls)
    .values({
      creatorId: user.id,
      shareToken: generateShareToken(),
      question,
      allowMultiple,
      showResultsBeforeVote,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    })
    .returning({ id: quickPolls.id, shareToken: quickPolls.shareToken });

  await db.insert(quickPollOptions).values(
    options.map((opt, i) => ({
      pollId: poll.id,
      label: opt.label,
      sortOrder: i,
    })),
  );

  return c.json({ id: poll.id, shareToken: poll.shareToken }, 201);
});

// List my polls
quickPollRoutes.get("/", async (c) => {
  const user = c.get("user");
  const polls = await db.query.quickPolls.findMany({
    where: eq(quickPolls.creatorId, user.id),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    with: {
      options: { orderBy: (o, { asc }) => [asc(o.sortOrder)] },
      votes: { columns: { id: true, optionId: true } },
    },
  });

  return c.json(
    polls.map((p) => ({
      id: p.id,
      question: p.question,
      shareToken: p.shareToken,
      status: isExpired(p) ? "closed" : p.status,
      allowMultiple: p.allowMultiple,
      expiresAt: p.expiresAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      options: p.options.map((o) => ({
        id: o.id,
        label: o.label,
        voteCount: p.votes.filter((v) => v.optionId === o.id).length,
      })),
      totalVotes: new Set(p.votes.map((v) => v.id)).size,
    })),
  );
});

// Update (close)
quickPollRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("id");
  const parsed = updateQuickPollSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const poll = await db.query.quickPolls.findFirst({
    where: and(eq(quickPolls.id, pollId), eq(quickPolls.creatorId, user.id)),
  });
  if (!poll) return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_FOUND }, 404);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.status === "closed") {
    updates.status = "closed";
    updates.closedAt = new Date();
  }

  const [updated] = await db
    .update(quickPolls)
    .set(updates)
    .where(eq(quickPolls.id, pollId))
    .returning({ id: quickPolls.id });

  return c.json(updated);
});

// Delete
quickPollRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("id");

  const poll = await db.query.quickPolls.findFirst({
    where: and(eq(quickPolls.id, pollId), eq(quickPolls.creatorId, user.id)),
  });
  if (!poll) return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_FOUND }, 404);

  await db.delete(quickPolls).where(eq(quickPolls.id, pollId));

  return c.body(null, 204);
});

function isExpired(poll: { expiresAt: Date; status: string }): boolean {
  return poll.status === "open" && poll.expiresAt < new Date();
}

export { quickPollRoutes };
```

**Step 2: Register routes in app.ts**

Add import and route registration in `apps/api/src/app.ts`:

```typescript
import { quickPollRoutes } from "./routes/quick-polls";
import { quickPollShareRoutes } from "./routes/quick-poll-share";
```

```typescript
app.route("/api/quick-polls", quickPollRoutes);
app.route("/", quickPollShareRoutes);
```

Note: `quickPollShareRoutes` will be created in Task 6. For now, add only the `quickPollRoutes` import and registration. Add `quickPollShareRoutes` after Task 6.

**Step 3: Run tests to verify they pass**

Run: `bun run --filter @sugara/api test -- --run apps/api/src/__tests__/quick-polls.test.ts`
Expected: PASS

**Step 4: Commit**

```
feat: Quick Poll CRUD APIルートを追加
```

---

## Task 5: API Tests - Share/Vote

**Files:**
- Modify: `apps/api/src/__tests__/quick-polls.test.ts`

**Step 1: Add tests for share and vote endpoints**

Append to the existing test file, in a new describe block:

```typescript
import { quickPollShareRoutes } from "../routes/quick-poll-share";

// Create a separate app for share routes (no auth)
const shareApp = new Hono();
shareApp.route("/", quickPollShareRoutes);

describe("Quick Poll Share routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/quick-polls/s/:shareToken", () => {
    it("should return poll by share token", async () => {
      const now = new Date();
      mockDbQuery.quickPolls.findFirst.mockResolvedValue({
        id: "poll-1",
        creatorId: "user-1",
        question: "A or B?",
        allowMultiple: false,
        showResultsBeforeVote: true,
        status: "open",
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: now,
        options: [
          { id: "o1", label: "A", sortOrder: 0 },
          { id: "o2", label: "B", sortOrder: 1 },
        ],
        votes: [],
      });

      const res = await shareApp.request("/api/quick-polls/s/abc123");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.question).toBe("A or B?");
      expect(body.options).toHaveLength(2);
    });

    it("should return 404 for expired poll", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue({
        id: "poll-1",
        status: "open",
        expiresAt: new Date(Date.now() - 1000),
        options: [],
        votes: [],
      });

      const res = await shareApp.request("/api/quick-polls/s/expired");

      expect(res.status).toBe(404);
    });

    it("should return 404 for non-existent token", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue(null);

      const res = await shareApp.request("/api/quick-polls/s/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/quick-polls/s/:shareToken/vote", () => {
    it("should accept a vote from anonymous user", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue({
        id: "poll-1",
        status: "open",
        allowMultiple: false,
        expiresAt: new Date(Date.now() + 86400000),
        options: [{ id: "o1" }, { id: "o2" }],
      });
      mockDbQuery.quickPollVotes.findMany.mockResolvedValue([]);
      const mockReturning = vi.fn().mockResolvedValue([{ id: "vote-1" }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockDbInsert.mockReturnValue({ values: mockValues });

      const res = await shareApp.request("/api/quick-polls/s/abc123/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionIds: ["o1"],
          anonymousId: "anon-uuid-1",
        }),
      });

      expect(res.status).toBe(200);
    });

    it("should reject vote on closed poll", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue({
        id: "poll-1",
        status: "closed",
        allowMultiple: false,
        expiresAt: new Date(Date.now() + 86400000),
        options: [{ id: "o1" }],
      });

      const res = await shareApp.request("/api/quick-polls/s/abc123/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionIds: ["o1"],
          anonymousId: "anon-uuid-1",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("should reject multiple options when allowMultiple is false", async () => {
      mockDbQuery.quickPolls.findFirst.mockResolvedValue({
        id: "poll-1",
        status: "open",
        allowMultiple: false,
        expiresAt: new Date(Date.now() + 86400000),
        options: [{ id: "o1" }, { id: "o2" }],
      });

      const res = await shareApp.request("/api/quick-polls/s/abc123/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionIds: ["o1", "o2"],
          anonymousId: "anon-uuid-1",
        }),
      });

      expect(res.status).toBe(400);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- --run apps/api/src/__tests__/quick-polls.test.ts`
Expected: FAIL (quick-poll-share module not found)

---

## Task 6: API Routes - Share/Vote

**Files:**
- Create: `apps/api/src/routes/quick-poll-share.ts`
- Modify: `apps/api/src/app.ts` (add quickPollShareRoutes)

**Step 1: Implement share/vote routes**

```typescript
// apps/api/src/routes/quick-poll-share.ts
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { quickPollOptions, quickPolls, quickPollVotes } from "../db/schema";
import { ERROR_MSG, RATE_LIMIT_PUBLIC_RESOURCE } from "../lib/constants";
import { auth } from "../lib/auth";
import { rateLimitByIp } from "../middleware/rate-limit";
import { quickPollDeleteVoteSchema, quickPollVoteSchema } from "@sugara/shared";
import type { AuthUser } from "../types";

const quickPollShareRoutes = new Hono();
const rateLimit = rateLimitByIp(RATE_LIMIT_PUBLIC_RESOURCE);

// Get poll by share token (no auth required)
quickPollShareRoutes.get("/api/quick-polls/s/:shareToken", rateLimit, async (c) => {
  const shareToken = c.req.param("shareToken");

  const poll = await db.query.quickPolls.findFirst({
    where: eq(quickPolls.shareToken, shareToken),
    with: {
      options: { orderBy: (o, { asc }) => [asc(o.sortOrder)] },
      votes: { columns: { id: true, optionId: true, userId: true, anonymousId: true } },
    },
  });

  if (!poll) return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_FOUND }, 404);

  if (poll.status === "open" && poll.expiresAt < new Date()) {
    return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_FOUND }, 404);
  }

  // Try to identify current user for myVoteOptionIds
  const user = await getOptionalUser(c);
  const anonymousId = c.req.query("anonymousId");

  const myVoteOptionIds = poll.votes
    .filter((v) => {
      if (user && v.userId === user.id) return true;
      if (anonymousId && v.anonymousId === anonymousId) return true;
      return false;
    })
    .map((v) => v.optionId);

  return c.json({
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    showResultsBeforeVote: poll.showResultsBeforeVote,
    status: poll.status === "open" && poll.expiresAt < new Date() ? "closed" : poll.status,
    creatorId: poll.creatorId,
    expiresAt: poll.expiresAt.toISOString(),
    createdAt: poll.createdAt.toISOString(),
    options: poll.options.map((o) => ({
      id: o.id,
      label: o.label,
      sortOrder: o.sortOrder,
      voteCount: poll.votes.filter((v) => v.optionId === o.id).length,
    })),
    totalVotes: poll.votes.length,
    myVoteOptionIds,
  });
});

// Vote (no auth required)
quickPollShareRoutes.post("/api/quick-polls/s/:shareToken/vote", rateLimit, async (c) => {
  const shareToken = c.req.param("shareToken");
  const parsed = quickPollVoteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { optionIds, anonymousId } = parsed.data;

  const poll = await db.query.quickPolls.findFirst({
    where: eq(quickPolls.shareToken, shareToken),
    with: { options: { columns: { id: true } } },
  });

  if (!poll) return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_FOUND }, 404);

  if (poll.status !== "open" || poll.expiresAt < new Date()) {
    return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_OPEN }, 400);
  }

  if (!poll.allowMultiple && optionIds.length > 1) {
    return c.json({ error: ERROR_MSG.QUICK_POLL_SINGLE_VOTE_ONLY }, 400);
  }

  // Validate all optionIds belong to this poll
  const validIds = new Set(poll.options.map((o) => o.id));
  if (optionIds.some((id) => !validIds.has(id))) {
    return c.json({ error: ERROR_MSG.QUICK_POLL_INVALID_OPTION }, 400);
  }

  const user = await getOptionalUser(c);
  const voterId = user?.id ?? null;
  const voterAnonymousId = !voterId ? anonymousId : undefined;

  if (!voterId && !voterAnonymousId) {
    return c.json({ error: "userId or anonymousId required" }, 400);
  }

  // Remove existing votes for this user/anonymous
  const deleteCondition = voterId
    ? and(eq(quickPollVotes.pollId, poll.id), eq(quickPollVotes.userId, voterId))
    : and(
        eq(quickPollVotes.pollId, poll.id),
        eq(quickPollVotes.anonymousId, voterAnonymousId!),
      );
  await db.delete(quickPollVotes).where(deleteCondition);

  // Insert new votes
  await db.insert(quickPollVotes).values(
    optionIds.map((optionId) => ({
      pollId: poll.id,
      optionId,
      userId: voterId,
      anonymousId: voterAnonymousId ?? null,
    })),
  );

  return c.json({ ok: true });
});

// Cancel vote (no auth required)
quickPollShareRoutes.delete("/api/quick-polls/s/:shareToken/vote", rateLimit, async (c) => {
  const shareToken = c.req.param("shareToken");

  const body = await c.req.json().catch(() => ({}));
  const parsed = quickPollDeleteVoteSchema.safeParse(body);
  const anonymousId = parsed.success ? parsed.data.anonymousId : undefined;

  const poll = await db.query.quickPolls.findFirst({
    where: eq(quickPolls.shareToken, shareToken),
    columns: { id: true, status: true, expiresAt: true },
  });

  if (!poll) return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_FOUND }, 404);

  if (poll.status !== "open" || poll.expiresAt < new Date()) {
    return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_OPEN }, 400);
  }

  const user = await getOptionalUser(c);
  const voterId = user?.id ?? null;
  const voterAnonymousId = !voterId ? anonymousId : undefined;

  if (!voterId && !voterAnonymousId) {
    return c.json({ error: "userId or anonymousId required" }, 400);
  }

  const deleteCondition = voterId
    ? and(eq(quickPollVotes.pollId, poll.id), eq(quickPollVotes.userId, voterId))
    : and(
        eq(quickPollVotes.pollId, poll.id),
        eq(quickPollVotes.anonymousId, voterAnonymousId!),
      );
  await db.delete(quickPollVotes).where(deleteCondition);

  return c.json({ ok: true });
});

async function getOptionalUser(c: { req: { raw: { headers: Headers } } }): Promise<AuthUser | null> {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    return (session?.user as AuthUser) ?? null;
  } catch {
    return null;
  }
}

export { quickPollShareRoutes };
```

**Step 2: Register in app.ts**

Add import and route:

```typescript
import { quickPollShareRoutes } from "./routes/quick-poll-share";
// ...
app.route("/", quickPollShareRoutes);
```

**Step 3: Run tests**

Run: `bun run --filter @sugara/api test -- --run apps/api/src/__tests__/quick-polls.test.ts`
Expected: PASS

**Step 4: Run full test suite**

Run: `bun run test`
Expected: PASS

**Step 5: Commit**

```
feat: Quick Poll 共有・投票APIルートを追加
```

---

## Task 7: Frontend - Query Keys + API Types

**Files:**
- Modify: `apps/web/lib/query-keys.ts`

**Step 1: Add query keys**

Add to `queryKeys`:

```typescript
quickPolls: {
  all: ["quick-polls"] as const,
  list: () => [...queryKeys.quickPolls.all, "list"] as const,
  shared: (token: string) => [...queryKeys.quickPolls.all, "shared", token] as const,
},
```

**Step 2: Verify build**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS

**Step 3: Commit**

```
feat: Quick Poll のクエリキーを追加
```

---

## Task 8: Frontend - Vote Page (/p/:shareToken)

**Files:**
- Create: `apps/web/app/p/[token]/page.tsx`
- Create: `apps/web/lib/hooks/use-quick-poll-sync.ts`

**Step 1: Create Realtime hook**

```typescript
// apps/web/lib/hooks/use-quick-poll-sync.ts
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase-browser";

export function useQuickPollSync(shareToken: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    if (!shareToken) return;

    const supabase = createClient();
    const channel = supabase.channel(`quick-poll:${shareToken}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "poll:voted" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.shared(shareToken) });
      })
      .on("broadcast", { event: "poll:closed" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.shared(shareToken) });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [shareToken, queryClient]);

  function broadcastVote() {
    channelRef.current?.send({ type: "broadcast", event: "poll:voted", payload: {} });
  }

  function broadcastClose() {
    channelRef.current?.send({ type: "broadcast", event: "poll:closed", payload: {} });
  }

  return { broadcastVote, broadcastClose };
}
```

**Step 2: Create vote page**

```typescript
// apps/web/app/p/[token]/page.tsx
"use client";

import type { QuickPollResponse } from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Link2, Vote, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useQuickPollSync } from "@/lib/hooks/use-quick-poll-sync";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

const ANONYMOUS_ID_KEY = "sugara_quick_poll_anon_id";

function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(ANONYMOUS_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANONYMOUS_ID_KEY, id);
  }
  return id;
}

export default function QuickPollPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : null;
  const queryClient = useQueryClient();
  const { broadcastVote, broadcastClose } = useQuickPollSync(token);

  const anonymousId = useMemo(() => getAnonymousId(), []);

  const {
    data: poll,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.quickPolls.shared(token ?? ""),
    queryFn: () =>
      api<QuickPollResponse>(`/api/quick-polls/s/${token}?anonymousId=${anonymousId}`),
    enabled: token !== null,
    retry: false,
  });

  const voteMutation = useMutation({
    mutationFn: (optionIds: string[]) =>
      api(`/api/quick-polls/s/${token}/vote`, {
        method: "POST",
        body: { optionIds, anonymousId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.shared(token ?? "") });
      broadcastVote();
      toast.success(MSG.QUICK_POLL_VOTED);
    },
    onError: () => toast.error(MSG.QUICK_POLL_VOTE_FAILED),
  });

  const cancelVoteMutation = useMutation({
    mutationFn: () =>
      api(`/api/quick-polls/s/${token}/vote`, {
        method: "DELETE",
        body: { anonymousId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.shared(token ?? "") });
      broadcastVote();
      toast.success(MSG.QUICK_POLL_VOTE_CANCELLED);
    },
    onError: () => toast.error(MSG.QUICK_POLL_VOTE_CANCEL_FAILED),
  });

  const isOpen = poll?.status === "open";
  const hasVoted = (poll?.myVoteOptionIds.length ?? 0) > 0;
  const canSeeResults = poll?.showResultsBeforeVote || hasVoted || !isOpen;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-14 items-center">
          <Logo />
          <span className="ml-2 text-sm text-muted-foreground">投票</span>
        </div>
      </header>
      <LoadingBoundary isLoading={isLoading} skeleton={<PollSkeleton />}>
        {error || !poll ? (
          <div className="container flex max-w-lg flex-col items-center py-16 text-center">
            <Vote className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-destructive">
              {MSG.QUICK_POLL_NOT_FOUND}
            </p>
          </div>
        ) : (
          <div className="container max-w-lg py-8 space-y-6">
            <h1 className="break-words text-xl font-bold">{poll.question}</h1>

            <div className="space-y-2">
              {poll.options.map((opt) => {
                const isSelected = poll.myVoteOptionIds.includes(opt.id);
                const percentage =
                  poll.totalVotes > 0
                    ? Math.round((opt.voteCount / poll.totalVotes) * 100)
                    : 0;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!isOpen || voteMutation.isPending}
                    onClick={() => {
                      if (!isOpen) return;
                      if (poll.allowMultiple) {
                        // Toggle: add or remove
                        const current = new Set(poll.myVoteOptionIds);
                        if (current.has(opt.id)) {
                          current.delete(opt.id);
                          if (current.size === 0) {
                            cancelVoteMutation.mutate();
                          } else {
                            voteMutation.mutate([...current]);
                          }
                        } else {
                          current.add(opt.id);
                          voteMutation.mutate([...current]);
                        }
                      } else {
                        // Single select
                        if (isSelected) {
                          cancelVoteMutation.mutate();
                        } else {
                          voteMutation.mutate([opt.id]);
                        }
                      }
                    }}
                    className={`relative w-full overflow-hidden rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    } ${!isOpen ? "cursor-default opacity-75" : ""}`}
                  >
                    {canSeeResults && (
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    )}
                    <div className="relative flex items-center justify-between">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <div className="flex items-center gap-2">
                        {canSeeResults && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {opt.voteCount}票 ({percentage}%)
                          </span>
                        )}
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {canSeeResults && (
              <p className="text-center text-xs text-muted-foreground">
                合計 {poll.totalVotes} 票
              </p>
            )}

            {!isOpen && (
              <p className="text-center text-sm text-muted-foreground">
                この投票は終了しています
              </p>
            )}
          </div>
        )}
      </LoadingBoundary>
    </div>
  );
}

function PollSkeleton() {
  return (
    <div className="container max-w-lg py-8 space-y-4">
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
```

**Step 3: Verify build**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS

**Step 4: Commit**

```
feat: Quick Poll 投票ページとリアルタイム同期を追加
```

---

## Task 9: Frontend - Create Page (/polls/new)

**Files:**
- Create: `apps/web/app/(authenticated)/polls/new/page.tsx`

**Step 1: Create poll creation page**

```typescript
// apps/web/app/(authenticated)/polls/new/page.tsx
"use client";

import { createQuickPollSchema, QUICK_POLL_OPTION_MAX_LENGTH, QUICK_POLL_QUESTION_MAX_LENGTH } from "@sugara/shared";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";

export default function NewQuickPollPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState([{ label: "" }, { label: "" }]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: { question: string; options: { label: string }[]; allowMultiple: boolean; showResultsBeforeVote: boolean }) =>
      api<{ id: string; shareToken: string }>("/api/quick-polls", {
        method: "POST",
        body: data,
      }),
    onSuccess: (data) => {
      const url = `${window.location.origin}/p/${data.shareToken}`;
      setShareUrl(url);
      toast.success(MSG.QUICK_POLL_CREATED);
    },
    onError: () => toast.error(MSG.QUICK_POLL_CREATE_FAILED),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nonEmptyOptions = options.filter((o) => o.label.trim());
    const data = {
      question: question.trim(),
      options: nonEmptyOptions,
      allowMultiple,
      showResultsBeforeVote,
    };
    const parsed = createQuickPollSchema.safeParse(data);
    if (!parsed.success) {
      toast.error("入力内容を確認してください");
      return;
    }
    createMutation.mutate(data);
  }

  function setYesNo() {
    setOptions([{ label: "はい" }, { label: "いいえ" }]);
  }

  function addOption() {
    if (options.length >= 10) return;
    setOptions([...options, { label: "" }]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, label: string) {
    setOptions(options.map((o, i) => (i === index ? { label } : o)));
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(MSG.QUICK_POLL_LINK_COPIED);
    } catch {
      toast.error(MSG.COPY_FAILED);
    }
  }

  if (shareUrl) {
    return (
      <div className="container max-w-lg py-8 space-y-6">
        <h1 className="text-xl font-bold">投票を作成しました</h1>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            以下のリンクを共有してください
          </p>
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="font-mono text-sm" />
            <Button onClick={copyShareUrl}>コピー</Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/polls")}>
            投票一覧へ
          </Button>
          <Button variant="outline" onClick={() => window.open(shareUrl, "_blank")}>
            投票ページを開く
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-lg py-8">
      <h1 className="mb-6 text-xl font-bold">投票を作成</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="question">質問</Label>
          <Input
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="何を聞きますか？"
            maxLength={QUICK_POLL_QUESTION_MAX_LENGTH}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>選択肢</Label>
            <Button type="button" variant="ghost" size="sm" onClick={setYesNo}>
              Yes/No
            </Button>
          </div>
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={opt.label}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`選択肢 ${i + 1}`}
                maxLength={QUICK_POLL_OPTION_MAX_LENGTH}
              />
              {options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOption(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <Plus className="mr-1 h-4 w-4" />
              追加
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="allowMultiple">複数選択を許可</Label>
            <Switch
              id="allowMultiple"
              checked={allowMultiple}
              onCheckedChange={setAllowMultiple}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="showResults">投票前に結果を表示</Label>
            <Switch
              id="showResults"
              checked={showResultsBeforeVote}
              onCheckedChange={setShowResultsBeforeVote}
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          投票を作成
        </Button>
      </form>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS

**Step 3: Commit**

```
feat: Quick Poll 作成ページを追加
```

---

## Task 10: Frontend - List Page (/polls)

**Files:**
- Create: `apps/web/app/(authenticated)/polls/page.tsx`

**Step 1: Create poll list page**

```typescript
// apps/web/app/(authenticated)/polls/page.tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2, Vote, XCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type PollListItem = {
  id: string;
  question: string;
  shareToken: string;
  status: "open" | "closed";
  allowMultiple: boolean;
  expiresAt: string;
  createdAt: string;
  options: { id: string; label: string; voteCount: number }[];
  totalVotes: number;
};

export default function PollsPage() {
  const queryClient = useQueryClient();

  const { data: polls, isLoading } = useQuery({
    queryKey: queryKeys.quickPolls.list(),
    queryFn: () => api<PollListItem[]>("/api/quick-polls"),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/quick-polls/${id}`, { method: "PATCH", body: { status: "closed" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.list() });
      toast.success(MSG.QUICK_POLL_CLOSED);
    },
    onError: () => toast.error(MSG.QUICK_POLL_CLOSE_FAILED),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/quick-polls/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.list() });
      toast.success(MSG.QUICK_POLL_DELETED);
    },
    onError: () => toast.error(MSG.QUICK_POLL_DELETE_FAILED),
  });

  async function copyLink(shareToken: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${shareToken}`);
      toast.success(MSG.QUICK_POLL_LINK_COPIED);
    } catch {
      toast.error(MSG.COPY_FAILED);
    }
  }

  return (
    <div className="container max-w-lg py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">投票</h1>
        <Button asChild size="sm">
          <Link href="/polls/new">
            <Plus className="mr-1 h-4 w-4" />
            作成
          </Link>
        </Button>
      </div>

      <LoadingBoundary
        isLoading={isLoading}
        skeleton={
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        }
      >
        {!polls?.length ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Vote className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{MSG.EMPTY_QUICK_POLL}</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/polls/new">投票を作成</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {polls.map((poll) => (
              <div key={poll.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{poll.question}</p>
                    <p className="text-xs text-muted-foreground">
                      {poll.totalVotes}票 /{" "}
                      {poll.status === "open" ? "受付中" : "終了"}
                    </p>
                  </div>
                  <div
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      poll.status === "open"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {poll.status === "open" ? "受付中" : "終了"}
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyLink(poll.shareToken)}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    リンク
                  </Button>
                  {poll.status === "open" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => closeMutation.mutate(poll.id)}
                      disabled={closeMutation.isPending}
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      終了
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(poll.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    削除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </LoadingBoundary>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS

**Step 3: Commit**

```
feat: Quick Poll 一覧ページを追加
```

---

## Task 11: Full Verification + FAQ

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`

**Step 1: Add FAQ entry**

Add to `FAQS` array in `apps/api/src/db/seed-faqs.ts`:

```typescript
{
  question: "投票機能はどう使いますか？",
  answer: "ログイン後「投票」ページから投票を作成できます。質問と選択肢を入力して作成すると、共有リンクが発行されます。リンクを共有すると、アカウントがなくても投票に参加できます。結果はリアルタイムで更新されます。投票は作成から7日後に自動的に終了します。",
},
```

**Step 2: Run full tests**

Run: `bun run test`
Expected: PASS

**Step 3: Run lint and type check**

Run: `bun run check && bun run check-types`
Expected: PASS

**Step 4: Seed FAQs**

Run: `bun run --filter @sugara/api db:seed-faqs`
Expected: FAQs seeded

**Step 5: Commit**

```
feat: Quick Poll のFAQを追加
```

---

## Notes

- The `supabase-browser` client import path in `use-quick-poll-sync.ts` should match the existing pattern in `use-trip-sync.ts`. Check the exact import path.
- The `api()` function in `apps/web/lib/api.ts` handles credentials automatically. For anonymous users on the vote page, credentials are still sent (they'll just be empty).
- The `anonymousId` is passed as a query parameter on GET (to determine `myVoteOptionIds`) and in the body on POST/DELETE.
- Rate limiting on share routes uses the existing `rateLimitByIp` middleware.
- All timestamps use `withTimezone: true` to match the existing schema pattern.
