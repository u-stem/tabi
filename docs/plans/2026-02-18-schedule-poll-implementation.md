# Schedule Poll (日程調整) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a schedule poll feature where users create candidate dates, invite participants, collect OK/Maybe/NG responses, and auto-create a trip upon confirmation.

**Architecture:** New `schedule_polls` domain with 4 DB tables, Hono API routes at `/api/polls`, and Next.js pages at `/polls/*`. Shared Zod schemas in `packages/shared`. Follows existing patterns: `requireAuth` middleware, Drizzle ORM, React Query, optimistic updates.

**Tech Stack:** Drizzle ORM (PostgreSQL), Hono, Zod, React 19, Next.js 15, TanStack Query, shadcn/ui, Tailwind CSS v4

**Design Doc:** `docs/plans/2026-02-18-schedule-poll-design.md`

---

## Task 1: Shared Schemas, Types, and Constants

**Files:**
- Create: `packages/shared/src/schemas/poll.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/limits.ts`

**Step 1: Create poll schema**

```typescript
// packages/shared/src/schemas/poll.ts
import { z } from "zod";

export const POLL_TITLE_MAX_LENGTH = 100;
export const POLL_DESTINATION_MAX_LENGTH = 100;
export const POLL_NOTE_MAX_LENGTH = 2000;
export const POLL_GUEST_NAME_MAX_LENGTH = 50;

export const pollStatusSchema = z.enum(["open", "confirmed", "closed"]);
export type PollStatus = z.infer<typeof pollStatusSchema>;

export const pollResponseValueSchema = z.enum(["ok", "maybe", "ng"]);
export type PollResponseValue = z.infer<typeof pollResponseValueSchema>;

export const createPollSchema = z.object({
  title: z.string().min(1).max(POLL_TITLE_MAX_LENGTH),
  destination: z.string().min(1).max(POLL_DESTINATION_MAX_LENGTH),
  note: z.string().max(POLL_NOTE_MAX_LENGTH).optional(),
  deadline: z.string().datetime().optional(),
  options: z
    .array(
      z
        .object({
          startDate: z.string().date(),
          endDate: z.string().date(),
        })
        .refine((d) => d.endDate >= d.startDate, {
          message: "End date must be on or after start date",
          path: ["endDate"],
        }),
    )
    .min(1),
});

export const updatePollSchema = z.object({
  title: z.string().min(1).max(POLL_TITLE_MAX_LENGTH).optional(),
  destination: z.string().min(1).max(POLL_DESTINATION_MAX_LENGTH).optional(),
  note: z.string().max(POLL_NOTE_MAX_LENGTH).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
});

export const addPollOptionSchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export const addPollParticipantSchema = z.object({
  userId: z.string().uuid(),
});

export const submitPollResponsesSchema = z.object({
  responses: z.array(
    z.object({
      optionId: z.string().uuid(),
      response: pollResponseValueSchema,
    }),
  ),
});

export const guestPollResponsesSchema = z.object({
  guestName: z.string().min(1).max(POLL_GUEST_NAME_MAX_LENGTH),
  responses: z.array(
    z.object({
      optionId: z.string().uuid(),
      response: pollResponseValueSchema,
    }),
  ),
});

export const confirmPollSchema = z.object({
  optionId: z.string().uuid(),
});
```

**Step 2: Add limits**

Add to `packages/shared/src/limits.ts`:
```typescript
export const MAX_POLLS_PER_USER = 10;
export const MAX_OPTIONS_PER_POLL = 20;
export const MAX_PARTICIPANTS_PER_POLL = 30;
```

**Step 3: Add response types**

Add to `packages/shared/src/types.ts`:
```typescript
import type { PollResponseValue, PollStatus } from "./schemas/poll";

export type PollOptionResponse = {
  id: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
};

export type PollParticipantResponse = {
  id: string;
  userId: string | null;
  name: string;
  image?: string | null;
  responses: { optionId: string; response: PollResponseValue }[];
};

export type PollListItem = {
  id: string;
  title: string;
  destination: string;
  status: PollStatus;
  deadline: string | null;
  participantCount: number;
  respondedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PollDetailResponse = {
  id: string;
  ownerId: string;
  title: string;
  destination: string;
  note: string | null;
  status: PollStatus;
  deadline: string | null;
  confirmedOptionId: string | null;
  tripId: string | null;
  options: PollOptionResponse[];
  participants: PollParticipantResponse[];
  isOwner: boolean;
  myParticipantId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SharedPollResponse = Omit<PollDetailResponse, "isOwner" | "myParticipantId">;
```

**Step 4: Export from schema index**

Add to `packages/shared/src/schemas/index.ts`:
```typescript
export * from "./poll";
```

**Step 5: Verify types compile**

Run: `bun run --filter @sugara/shared check-types`
Expected: PASS

**Step 6: Commit**

```
feat: 日程調整機能の共有スキーマ・型・制限値を追加
```

---

## Task 2: DB Schema

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: Add enums and tables**

Add after `scheduleColorEnum` definition (line 57), before `// --- Tables ---`:

```typescript
export const pollStatusEnum = pgEnum("poll_status", ["open", "confirmed", "closed"]);
export const pollResponseEnum = pgEnum("poll_response", ["ok", "maybe", "ng"]);
```

Add after `groupMembers` table (line 336), before `// --- Relations ---`:

```typescript
export const schedulePolls = pgTable(
  "schedule_polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 100 }).notNull(),
    destination: varchar("destination", { length: 100 }).notNull(),
    note: text("note"),
    status: pollStatusEnum("status").notNull().default("open"),
    deadline: timestamp("deadline", { withTimezone: true }),
    shareToken: varchar("share_token", { length: 64 }).unique(),
    confirmedOptionId: uuid("confirmed_option_id"),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("schedule_polls_owner_id_idx").on(table.ownerId)],
).enableRLS();

export const schedulePollOptions = pgTable(
  "schedule_poll_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => schedulePolls.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("schedule_poll_options_poll_id_idx").on(table.pollId),
    check("poll_options_date_range_check", sql`${table.endDate} >= ${table.startDate}`),
  ],
).enableRLS();

export const schedulePollParticipants = pgTable(
  "schedule_poll_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => schedulePolls.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestName: varchar("guest_name", { length: 50 }),
  },
  (table) => [
    index("schedule_poll_participants_poll_id_idx").on(table.pollId),
    uniqueIndex("schedule_poll_participants_poll_user_unique")
      .on(table.pollId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
  ],
).enableRLS();

export const schedulePollResponses = pgTable(
  "schedule_poll_responses",
  {
    participantId: uuid("participant_id")
      .notNull()
      .references(() => schedulePollParticipants.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => schedulePollOptions.id, { onDelete: "cascade" }),
    response: pollResponseEnum("response").notNull(),
  },
  (table) => [primaryKey({ columns: [table.participantId, table.optionId] })],
).enableRLS();
```

**Step 2: Add relations**

Add after `bookmarksRelations`:

```typescript
export const schedulePollsRelations = relations(schedulePolls, ({ one, many }) => ({
  owner: one(users, { fields: [schedulePolls.ownerId], references: [users.id] }),
  trip: one(trips, { fields: [schedulePolls.tripId], references: [trips.id] }),
  options: many(schedulePollOptions),
  participants: many(schedulePollParticipants),
}));

export const schedulePollOptionsRelations = relations(schedulePollOptions, ({ one, many }) => ({
  poll: one(schedulePolls, { fields: [schedulePollOptions.pollId], references: [schedulePolls.id] }),
  responses: many(schedulePollResponses),
}));

export const schedulePollParticipantsRelations = relations(
  schedulePollParticipants,
  ({ one, many }) => ({
    poll: one(schedulePolls, {
      fields: [schedulePollParticipants.pollId],
      references: [schedulePolls.id],
    }),
    user: one(users, { fields: [schedulePollParticipants.userId], references: [users.id] }),
    responses: many(schedulePollResponses),
  }),
);

export const schedulePollResponsesRelations = relations(schedulePollResponses, ({ one }) => ({
  participant: one(schedulePollParticipants, {
    fields: [schedulePollResponses.participantId],
    references: [schedulePollParticipants.id],
  }),
  option: one(schedulePollOptions, {
    fields: [schedulePollResponses.optionId],
    references: [schedulePollOptions.id],
  }),
}));
```

Also add to `usersRelations`:
```typescript
schedulePolls: many(schedulePolls),
schedulePollParticipations: many(schedulePollParticipants),
```

And add to `tripsRelations`:
```typescript
schedulePoll: one(schedulePolls),
```

**Step 3: Verify types compile**

Run: `bun run check-types`
Expected: PASS

**Step 4: Push schema to DB**

Run: `bun run db:push`
Expected: Tables created successfully

**Step 5: Commit**

```
feat: 日程調整機能のDBスキーマを追加
```

---

## Task 3: API Constants and Middleware

**Files:**
- Modify: `apps/api/src/lib/constants.ts`
- Modify: `apps/api/src/types.ts`
- Create: `apps/api/src/lib/poll-access.ts`

**Step 1: Add error messages**

Add to `ERROR_MSG` in `apps/api/src/lib/constants.ts`:
```typescript
POLL_NOT_FOUND: "Poll not found",
POLL_NOT_OPEN: "Poll is not open",
POLL_OPTION_NOT_FOUND: "Poll option not found",
POLL_PARTICIPANT_NOT_FOUND: "Participant not found",
POLL_ALREADY_PARTICIPANT: "Already a participant",
POLL_DEADLINE_PASSED: "Poll deadline has passed",
POLL_SHARED_NOT_FOUND: "Shared poll not found",
LIMIT_POLLS: "Poll limit reached",
LIMIT_POLL_OPTIONS: "Poll option limit reached",
LIMIT_POLL_PARTICIPANTS: "Poll participant limit reached",
```

**Step 2: Create poll access helper**

```typescript
// apps/api/src/lib/poll-access.ts
import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import { schedulePollParticipants, schedulePolls } from "../db/schema";

export async function findPollAsOwner(pollId: string, userId: string) {
  return db.query.schedulePolls.findFirst({
    where: and(eq(schedulePolls.id, pollId), eq(schedulePolls.ownerId, userId)),
  });
}

export async function findPollAsParticipant(pollId: string, userId: string) {
  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.id, pollId),
    with: {
      participants: {
        where: eq(schedulePollParticipants.userId, userId),
      },
    },
  });
  if (!poll) return null;
  // Owner always has access, participants have access via participant record
  if (poll.ownerId === userId) return poll;
  if (poll.participants.length > 0) return poll;
  return null;
}
```

**Step 3: Verify types compile**

Run: `bun run --filter @sugara/api check-types`
Expected: PASS

**Step 4: Commit**

```
feat: 日程調整のAPIエラーメッセージとアクセスヘルパーを追加
```

---

## Task 4: Poll CRUD API Routes + Tests

**Files:**
- Create: `apps/api/src/routes/polls.ts`
- Create: `apps/api/src/__tests__/integration/polls.integration.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/__tests__/integration/setup.ts`

**Step 1: Write integration tests for create and list**

```typescript
// apps/api/src/__tests__/integration/polls.integration.test.ts
import { Hono } from "hono";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("../../db/index", async () => {
  const { getTestDb } = await import("./setup");
  return { db: getTestDb() };
});

vi.mock("../../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

import { pollRoutes } from "../../routes/polls";
import { cleanupTables, createTestUser, teardownTestDb } from "./setup";

function createApp() {
  const app = new Hono();
  app.route("/api/polls", pollRoutes);
  return app;
}

describe("Polls Integration", () => {
  const app = createApp();
  let owner: { id: string; name: string; email: string };

  beforeEach(async () => {
    await cleanupTables();
    owner = await createTestUser({ name: "Owner", email: "owner@test.com" });
    mockGetSession.mockImplementation(() => ({
      user: owner,
      session: { id: "test-session" },
    }));
  });

  afterAll(async () => {
    await cleanupTables();
    await teardownTestDb();
  });

  it("creates a poll with options and auto-adds owner as participant", async () => {
    const res = await app.request("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Summer Trip",
        destination: "Okinawa",
        options: [
          { startDate: "2026-08-01", endDate: "2026-08-03" },
          { startDate: "2026-08-08", endDate: "2026-08-10" },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const poll = await res.json();
    expect(poll.title).toBe("Summer Trip");
    expect(poll.status).toBe("open");
    expect(poll.options).toHaveLength(2);
    expect(poll.participants).toHaveLength(1);
    expect(poll.participants[0].userId).toBe(owner.id);
  });

  it("lists polls where user is owner or participant", async () => {
    // Create a poll
    await app.request("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "My Poll",
        destination: "Tokyo",
        options: [{ startDate: "2026-09-01", endDate: "2026-09-01" }],
      }),
    });

    const res = await app.request("/api/polls");
    expect(res.status).toBe(200);
    const polls = await res.json();
    expect(polls).toHaveLength(1);
    expect(polls[0].title).toBe("My Poll");
    expect(polls[0].participantCount).toBe(1);
    expect(polls[0].respondedCount).toBe(0);
  });

  it("non-participant cannot see poll", async () => {
    await app.request("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Private Poll",
        destination: "Kyoto",
        options: [{ startDate: "2026-10-01", endDate: "2026-10-01" }],
      }),
    });

    const stranger = await createTestUser({ name: "Stranger", email: "stranger@test.com" });
    mockGetSession.mockImplementation(() => ({
      user: stranger,
      session: { id: "stranger-session" },
    }));

    const res = await app.request("/api/polls");
    const polls = await res.json();
    expect(polls).toHaveLength(0);
  });

  it("gets poll detail with options and participants", async () => {
    const createRes = await app.request("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Detail Poll",
        destination: "Osaka",
        note: "test note",
        options: [
          { startDate: "2026-11-01", endDate: "2026-11-03" },
        ],
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/polls/${created.id}`);
    expect(res.status).toBe(200);
    const detail = await res.json();
    expect(detail.title).toBe("Detail Poll");
    expect(detail.note).toBe("test note");
    expect(detail.isOwner).toBe(true);
    expect(detail.options).toHaveLength(1);
    expect(detail.participants).toHaveLength(1);
    expect(detail.myParticipantId).toBeTruthy();
  });

  it("updates poll title and note", async () => {
    const createRes = await app.request("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Old Title",
        destination: "Nara",
        options: [{ startDate: "2026-12-01", endDate: "2026-12-01" }],
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/polls/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Title", note: "updated note" }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.title).toBe("New Title");
    expect(updated.note).toBe("updated note");
  });

  it("deletes poll as owner", async () => {
    const createRes = await app.request("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Delete Me",
        destination: "Sapporo",
        options: [{ startDate: "2026-07-01", endDate: "2026-07-01" }],
      }),
    });
    const created = await createRes.json();

    const res = await app.request(`/api/polls/${created.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);

    const listRes = await app.request("/api/polls");
    const polls = await listRes.json();
    expect(polls).toHaveLength(0);
  });

  it("non-owner cannot delete poll", async () => {
    const createRes = await app.request("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Protected",
        destination: "Fukuoka",
        options: [{ startDate: "2026-06-01", endDate: "2026-06-01" }],
      }),
    });
    const created = await createRes.json();

    const other = await createTestUser({ name: "Other", email: "other@test.com" });

    // Add other as participant
    const { getTestDb } = await import("./setup");
    const db = getTestDb();
    const { schedulePollParticipants } = await import("../../db/schema");
    await db.insert(schedulePollParticipants).values({
      pollId: created.id,
      userId: other.id,
    });

    mockGetSession.mockImplementation(() => ({
      user: other,
      session: { id: "other-session" },
    }));

    const res = await app.request(`/api/polls/${created.id}`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: FAIL (pollRoutes not found)

**Step 3: Implement poll routes**

```typescript
// apps/api/src/routes/polls.ts
import {
  MAX_OPTIONS_PER_POLL,
  MAX_POLLS_PER_USER,
  createPollSchema,
  updatePollSchema,
} from "@sugara/shared";
import { and, count, desc, eq, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import {
  schedulePollOptions,
  schedulePollParticipants,
  schedulePollResponses,
  schedulePolls,
  users,
} from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { findPollAsOwner, findPollAsParticipant } from "../lib/poll-access";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const pollRoutes = new Hono<AppEnv>();
pollRoutes.use("*", requireAuth);

// List polls (owned or participant)
pollRoutes.get("/", async (c) => {
  const user = c.get("user");

  const ownedPolls = await db
    .select({
      id: schedulePolls.id,
      title: schedulePolls.title,
      destination: schedulePolls.destination,
      status: schedulePolls.status,
      deadline: schedulePolls.deadline,
      createdAt: schedulePolls.createdAt,
      updatedAt: schedulePolls.updatedAt,
    })
    .from(schedulePolls)
    .where(eq(schedulePolls.ownerId, user.id))
    .orderBy(desc(schedulePolls.updatedAt));

  const participatingPolls = await db
    .select({
      id: schedulePolls.id,
      title: schedulePolls.title,
      destination: schedulePolls.destination,
      status: schedulePolls.status,
      deadline: schedulePolls.deadline,
      createdAt: schedulePolls.createdAt,
      updatedAt: schedulePolls.updatedAt,
    })
    .from(schedulePollParticipants)
    .innerJoin(schedulePolls, eq(schedulePollParticipants.pollId, schedulePolls.id))
    .where(
      and(
        eq(schedulePollParticipants.userId, user.id),
        // Exclude owned polls (already in ownedPolls)
        sql`${schedulePolls.ownerId} != ${user.id}`,
      ),
    )
    .orderBy(desc(schedulePolls.updatedAt));

  const allPollIds = [
    ...ownedPolls.map((p) => p.id),
    ...participatingPolls.map((p) => p.id),
  ];

  if (allPollIds.length === 0) return c.json([]);

  // Batch-fetch counts for all polls
  const participantCounts = await db
    .select({
      pollId: schedulePollParticipants.pollId,
      count: count(),
    })
    .from(schedulePollParticipants)
    .where(sql`${schedulePollParticipants.pollId} IN ${allPollIds}`)
    .groupBy(schedulePollParticipants.pollId);

  // Count participants who have at least one response
  const respondedCounts = await db
    .select({
      pollId: schedulePollParticipants.pollId,
      count: count(sql`DISTINCT ${schedulePollResponses.participantId}`),
    })
    .from(schedulePollParticipants)
    .innerJoin(
      schedulePollResponses,
      eq(schedulePollParticipants.id, schedulePollResponses.participantId),
    )
    .where(sql`${schedulePollParticipants.pollId} IN ${allPollIds}`)
    .groupBy(schedulePollParticipants.pollId);

  const participantMap = new Map(participantCounts.map((r) => [r.pollId, r.count]));
  const respondedMap = new Map(respondedCounts.map((r) => [r.pollId, r.count]));

  const allPolls = [...ownedPolls, ...participatingPolls]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return c.json(
    allPolls.map((p) => ({
      ...p,
      deadline: p.deadline?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      participantCount: participantMap.get(p.id) ?? 0,
      respondedCount: respondedMap.get(p.id) ?? 0,
    })),
  );
});

// Create poll
pollRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createPollSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { title, destination, note, deadline, options } = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [pollCount] = await tx
      .select({ count: count() })
      .from(schedulePolls)
      .where(eq(schedulePolls.ownerId, user.id));
    if (pollCount.count >= MAX_POLLS_PER_USER) {
      return null;
    }

    const [poll] = await tx
      .insert(schedulePolls)
      .values({
        ownerId: user.id,
        title,
        destination,
        note: note ?? null,
        deadline: deadline ? new Date(deadline) : null,
      })
      .returning();

    const insertedOptions = await tx
      .insert(schedulePollOptions)
      .values(
        options.map((opt, i) => ({
          pollId: poll.id,
          startDate: opt.startDate,
          endDate: opt.endDate,
          sortOrder: i,
        })),
      )
      .returning();

    // Auto-add owner as participant
    const [ownerParticipant] = await tx
      .insert(schedulePollParticipants)
      .values({ pollId: poll.id, userId: user.id })
      .returning();

    return { poll, options: insertedOptions, ownerParticipant };
  });

  if (!result) {
    return c.json({ error: ERROR_MSG.LIMIT_POLLS }, 409);
  }

  return c.json(
    {
      ...result.poll,
      deadline: result.poll.deadline?.toISOString() ?? null,
      createdAt: result.poll.createdAt.toISOString(),
      updatedAt: result.poll.updatedAt.toISOString(),
      options: result.options.map((o) => ({
        id: o.id,
        startDate: o.startDate,
        endDate: o.endDate,
        sortOrder: o.sortOrder,
      })),
      participants: [
        {
          id: result.ownerParticipant.id,
          userId: user.id,
          name: user.name,
          image: null,
          responses: [],
        },
      ],
    },
    201,
  );
});

// Get poll detail
pollRoutes.get("/:pollId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");

  const poll = await findPollAsParticipant(pollId, user.id);
  if (!poll) {
    return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  }

  const [options, participants] = await Promise.all([
    db.query.schedulePollOptions.findMany({
      where: eq(schedulePollOptions.pollId, pollId),
      orderBy: (o, { asc }) => [asc(o.sortOrder)],
    }),
    db.query.schedulePollParticipants.findMany({
      where: eq(schedulePollParticipants.pollId, pollId),
      with: {
        user: { columns: { id: true, name: true, image: true } },
        responses: true,
      },
    }),
  ]);

  const myParticipant = participants.find((p) => p.userId === user.id);

  return c.json({
    id: poll.id,
    ownerId: poll.ownerId,
    title: poll.title,
    destination: poll.destination,
    note: poll.note,
    status: poll.status,
    deadline: poll.deadline?.toISOString() ?? null,
    confirmedOptionId: poll.confirmedOptionId,
    tripId: poll.tripId,
    options: options.map((o) => ({
      id: o.id,
      startDate: o.startDate,
      endDate: o.endDate,
      sortOrder: o.sortOrder,
    })),
    participants: participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user?.name ?? p.guestName ?? "Guest",
      image: p.user?.image ?? null,
      responses: p.responses.map((r) => ({
        optionId: r.optionId,
        response: r.response,
      })),
    })),
    isOwner: poll.ownerId === user.id,
    myParticipantId: myParticipant?.id ?? null,
    createdAt: poll.createdAt.toISOString(),
    updatedAt: poll.updatedAt.toISOString(),
  });
});

// Update poll (owner only, open only)
pollRoutes.patch("/:pollId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const parsed = updatePollSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) {
    return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  }
  if (poll.status !== "open") {
    return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.destination !== undefined) updates.destination = parsed.data.destination;
  if (parsed.data.note !== undefined) updates.note = parsed.data.note;
  if (parsed.data.deadline !== undefined) {
    updates.deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;
  }

  const [updated] = await db
    .update(schedulePolls)
    .set(updates)
    .where(eq(schedulePolls.id, pollId))
    .returning();

  return c.json({
    ...updated,
    deadline: updated.deadline?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

// Delete poll (owner only)
pollRoutes.delete("/:pollId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) {
    return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  }

  await db.delete(schedulePolls).where(eq(schedulePolls.id, pollId));
  return c.json({ ok: true });
});

export { pollRoutes };
```

**Step 4: Register routes in app.ts**

Add import and route:
```typescript
import { pollRoutes } from "./routes/polls";
// ...
app.route("/api/polls", pollRoutes);
```

**Step 5: Update cleanupTables in setup.ts**

Update the TRUNCATE statement in `cleanupTables()` to include new tables:
```sql
TRUNCATE schedule_poll_responses, schedule_poll_participants, schedule_poll_options, schedule_polls, schedules, day_patterns, trip_days, trip_members, trips, verifications, accounts, sessions, users CASCADE
```

**Step 6: Run tests**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: All PASS

**Step 7: Run full test suite**

Run: `bun run test`
Expected: All PASS

**Step 8: Commit**

```
feat: 日程調整CRUD APIルートとテストを追加
```

---

## Task 5: Options, Participants, Responses API + Tests

**Files:**
- Modify: `apps/api/src/routes/polls.ts`
- Modify: `apps/api/src/__tests__/integration/polls.integration.test.ts`

**Step 1: Write tests for options, participants, and responses**

Add to the test file:

```typescript
it("adds an option to open poll", async () => {
  const createRes = await app.request("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Options Test",
      destination: "Tokyo",
      options: [{ startDate: "2026-08-01", endDate: "2026-08-01" }],
    }),
  });
  const poll = await createRes.json();

  const res = await app.request(`/api/polls/${poll.id}/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startDate: "2026-08-15", endDate: "2026-08-17" }),
  });
  expect(res.status).toBe(201);
  const option = await res.json();
  expect(option.startDate).toBe("2026-08-15");
});

it("deletes an option", async () => {
  const createRes = await app.request("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Del Option",
      destination: "Tokyo",
      options: [
        { startDate: "2026-08-01", endDate: "2026-08-01" },
        { startDate: "2026-08-02", endDate: "2026-08-02" },
      ],
    }),
  });
  const poll = await createRes.json();
  const optionId = poll.options[0].id;

  const res = await app.request(`/api/polls/${poll.id}/options/${optionId}`, {
    method: "DELETE",
  });
  expect(res.status).toBe(200);
});

it("adds a participant", async () => {
  const other = await createTestUser({ name: "Invitee", email: "invitee@test.com" });
  const createRes = await app.request("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Invite Test",
      destination: "Tokyo",
      options: [{ startDate: "2026-08-01", endDate: "2026-08-01" }],
    }),
  });
  const poll = await createRes.json();

  const res = await app.request(`/api/polls/${poll.id}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: other.id }),
  });
  expect(res.status).toBe(201);
});

it("submits responses for all options", async () => {
  const createRes = await app.request("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Response Test",
      destination: "Tokyo",
      options: [
        { startDate: "2026-08-01", endDate: "2026-08-01" },
        { startDate: "2026-08-02", endDate: "2026-08-02" },
      ],
    }),
  });
  const poll = await createRes.json();

  const res = await app.request(`/api/polls/${poll.id}/responses`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      responses: [
        { optionId: poll.options[0].id, response: "ok" },
        { optionId: poll.options[1].id, response: "ng" },
      ],
    }),
  });
  expect(res.status).toBe(200);

  // Verify via detail
  const detailRes = await app.request(`/api/polls/${poll.id}`);
  const detail = await detailRes.json();
  const myResponses = detail.participants[0].responses;
  expect(myResponses).toHaveLength(2);
  expect(myResponses.find((r: { optionId: string }) => r.optionId === poll.options[0].id).response).toBe("ok");
});

it("rejects responses after deadline", async () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const createRes = await app.request("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Deadline Test",
      destination: "Tokyo",
      deadline: past,
      options: [{ startDate: "2026-08-01", endDate: "2026-08-01" }],
    }),
  });
  const poll = await createRes.json();

  const res = await app.request(`/api/polls/${poll.id}/responses`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      responses: [{ optionId: poll.options[0].id, response: "ok" }],
    }),
  });
  expect(res.status).toBe(400);
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: New tests FAIL

**Step 3: Implement option routes**

Add to `polls.ts`:

```typescript
// Add option (owner only, open only)
pollRoutes.post("/:pollId/options", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const parsed = addPollOptionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);

  const [optionCount] = await db
    .select({ count: count() })
    .from(schedulePollOptions)
    .where(eq(schedulePollOptions.pollId, pollId));
  if (optionCount.count >= MAX_OPTIONS_PER_POLL) {
    return c.json({ error: ERROR_MSG.LIMIT_POLL_OPTIONS }, 409);
  }

  const [option] = await db
    .insert(schedulePollOptions)
    .values({
      pollId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      sortOrder: optionCount.count,
    })
    .returning();

  await db
    .update(schedulePolls)
    .set({ updatedAt: new Date() })
    .where(eq(schedulePolls.id, pollId));

  return c.json(
    { id: option.id, startDate: option.startDate, endDate: option.endDate, sortOrder: option.sortOrder },
    201,
  );
});

// Delete option (owner only, open only)
pollRoutes.delete("/:pollId/options/:optionId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const optionId = c.req.param("optionId");

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);

  const deleted = await db
    .delete(schedulePollOptions)
    .where(and(eq(schedulePollOptions.id, optionId), eq(schedulePollOptions.pollId, pollId)))
    .returning();
  if (deleted.length === 0) return c.json({ error: ERROR_MSG.POLL_OPTION_NOT_FOUND }, 404);

  await db
    .update(schedulePolls)
    .set({ updatedAt: new Date() })
    .where(eq(schedulePolls.id, pollId));

  return c.json({ ok: true });
});
```

**Step 4: Implement participant routes**

```typescript
// Add participant (owner only)
pollRoutes.post("/:pollId/participants", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const parsed = addPollParticipantSchema.safeParse(body);

  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);

  const [participantCount] = await db
    .select({ count: count() })
    .from(schedulePollParticipants)
    .where(eq(schedulePollParticipants.pollId, pollId));
  if (participantCount.count >= MAX_PARTICIPANTS_PER_POLL) {
    return c.json({ error: ERROR_MSG.LIMIT_POLL_PARTICIPANTS }, 409);
  }

  // Verify user exists
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, parsed.data.userId),
    columns: { id: true, name: true, image: true },
  });
  if (!targetUser) return c.json({ error: ERROR_MSG.USER_NOT_FOUND }, 404);

  // Check not already participant
  const existing = await db.query.schedulePollParticipants.findFirst({
    where: and(
      eq(schedulePollParticipants.pollId, pollId),
      eq(schedulePollParticipants.userId, parsed.data.userId),
    ),
  });
  if (existing) return c.json({ error: ERROR_MSG.POLL_ALREADY_PARTICIPANT }, 409);

  const [participant] = await db
    .insert(schedulePollParticipants)
    .values({ pollId, userId: parsed.data.userId })
    .returning();

  await db
    .update(schedulePolls)
    .set({ updatedAt: new Date() })
    .where(eq(schedulePolls.id, pollId));

  return c.json(
    {
      id: participant.id,
      userId: targetUser.id,
      name: targetUser.name,
      image: targetUser.image,
      responses: [],
    },
    201,
  );
});

// Delete participant (owner only)
pollRoutes.delete("/:pollId/participants/:participantId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const participantId = c.req.param("participantId");

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);

  const deleted = await db
    .delete(schedulePollParticipants)
    .where(
      and(
        eq(schedulePollParticipants.id, participantId),
        eq(schedulePollParticipants.pollId, pollId),
      ),
    )
    .returning();
  if (deleted.length === 0) return c.json({ error: ERROR_MSG.POLL_PARTICIPANT_NOT_FOUND }, 404);

  await db
    .update(schedulePolls)
    .set({ updatedAt: new Date() })
    .where(eq(schedulePolls.id, pollId));

  return c.json({ ok: true });
});
```

**Step 5: Implement response routes**

```typescript
// Submit responses (participant only)
pollRoutes.put("/:pollId/responses", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const parsed = submitPollResponsesSchema.safeParse(body);

  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const poll = await findPollAsParticipant(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);
  if (poll.deadline && poll.deadline < new Date()) {
    return c.json({ error: ERROR_MSG.POLL_DEADLINE_PASSED }, 400);
  }

  // Find participant record
  const participant = await db.query.schedulePollParticipants.findFirst({
    where: and(
      eq(schedulePollParticipants.pollId, pollId),
      eq(schedulePollParticipants.userId, user.id),
    ),
  });
  if (!participant) return c.json({ error: ERROR_MSG.POLL_PARTICIPANT_NOT_FOUND }, 404);

  await db.transaction(async (tx) => {
    // Delete existing responses
    await tx
      .delete(schedulePollResponses)
      .where(eq(schedulePollResponses.participantId, participant.id));

    // Insert new responses
    if (parsed.data.responses.length > 0) {
      await tx.insert(schedulePollResponses).values(
        parsed.data.responses.map((r) => ({
          participantId: participant.id,
          optionId: r.optionId,
          response: r.response,
        })),
      );
    }
  });

  await db
    .update(schedulePolls)
    .set({ updatedAt: new Date() })
    .where(eq(schedulePolls.id, pollId));

  return c.json({ ok: true });
});
```

Add missing imports at the top:
```typescript
import {
  addPollOptionSchema,
  addPollParticipantSchema,
  submitPollResponsesSchema,
  MAX_PARTICIPANTS_PER_POLL,
} from "@sugara/shared";
```

**Step 6: Run tests**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: All PASS

**Step 7: Commit**

```
feat: 日程調整の候補・参加者・回答APIを追加
```

---

## Task 6: Share Link and Confirm API + Tests

**Files:**
- Modify: `apps/api/src/routes/polls.ts`
- Modify: `apps/api/src/__tests__/integration/polls.integration.test.ts`

**Step 1: Write tests for share and confirm**

```typescript
it("generates share token", async () => {
  const createRes = await app.request("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Share Test",
      destination: "Tokyo",
      options: [{ startDate: "2026-08-01", endDate: "2026-08-01" }],
    }),
  });
  const poll = await createRes.json();

  const res = await app.request(`/api/polls/${poll.id}/share`, { method: "POST" });
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.shareToken).toBeTruthy();
});

it("confirms poll and creates trip", async () => {
  const other = await createTestUser({ name: "Member", email: "member@test.com" });
  const createRes = await app.request("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Confirm Test",
      destination: "Osaka",
      options: [
        { startDate: "2026-08-01", endDate: "2026-08-03" },
      ],
    }),
  });
  const poll = await createRes.json();

  // Add participant
  await app.request(`/api/polls/${poll.id}/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: other.id }),
  });

  // Confirm
  const res = await app.request(`/api/polls/${poll.id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionId: poll.options[0].id }),
  });
  expect(res.status).toBe(200);
  const confirmed = await res.json();
  expect(confirmed.status).toBe("confirmed");
  expect(confirmed.tripId).toBeTruthy();

  // Verify trip was created
  const { getTestDb } = await import("./setup");
  const db = getTestDb();
  const { trips, tripMembers } = await import("../../db/schema");
  const { eq } = await import("drizzle-orm");

  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, confirmed.tripId),
  });
  expect(trip).toBeTruthy();
  expect(trip!.title).toBe("Confirm Test");
  expect(trip!.destination).toBe("Osaka");
  expect(trip!.startDate).toBe("2026-08-01");
  expect(trip!.endDate).toBe("2026-08-03");

  // Verify members (owner + other, not guests)
  const members = await db.query.tripMembers.findMany({
    where: eq(tripMembers.tripId, confirmed.tripId),
  });
  expect(members).toHaveLength(2);
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: New tests FAIL

**Step 3: Implement share routes**

Add to `polls.ts` (these are registered at `/api/polls` base, so shared routes need special handling):

```typescript
// Generate share token (owner only)
pollRoutes.post("/:pollId/share", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);

  if (poll.shareToken) {
    return c.json({ shareToken: poll.shareToken });
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  const [updated] = await db
    .update(schedulePolls)
    .set({ shareToken: token, updatedAt: new Date() })
    .where(and(eq(schedulePolls.id, pollId), sql`${schedulePolls.shareToken} IS NULL`))
    .returning({ shareToken: schedulePolls.shareToken });

  if (!updated) {
    // Race condition: another request set it already
    const refreshed = await db.query.schedulePolls.findFirst({
      where: eq(schedulePolls.id, pollId),
      columns: { shareToken: true },
    });
    return c.json({ shareToken: refreshed?.shareToken });
  }

  return c.json({ shareToken: updated.shareToken });
});
```

**Step 4: Implement confirm route**

```typescript
import { confirmPollSchema } from "@sugara/shared";
import { tripMembers, trips } from "../db/schema";
import { createInitialTripDays } from "../lib/trip-days";

// Confirm poll and create trip (owner only)
pollRoutes.post("/:pollId/confirm", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const parsed = confirmPollSchema.safeParse(body);

  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);

  const option = await db.query.schedulePollOptions.findFirst({
    where: and(
      eq(schedulePollOptions.id, parsed.data.optionId),
      eq(schedulePollOptions.pollId, pollId),
    ),
  });
  if (!option) return c.json({ error: ERROR_MSG.POLL_OPTION_NOT_FOUND }, 404);

  const result = await db.transaction(async (tx) => {
    // Create trip
    const [trip] = await tx
      .insert(trips)
      .values({
        ownerId: user.id,
        title: poll.title,
        destination: poll.destination,
        startDate: option.startDate,
        endDate: option.endDate,
      })
      .returning();

    await createInitialTripDays(tx, trip.id, option.startDate, option.endDate);

    // Add registered participants as trip members
    const participants = await tx.query.schedulePollParticipants.findMany({
      where: eq(schedulePollParticipants.pollId, pollId),
    });

    const registeredParticipants = participants.filter((p) => p.userId !== null);
    if (registeredParticipants.length > 0) {
      await tx.insert(tripMembers).values(
        registeredParticipants.map((p) => ({
          tripId: trip.id,
          userId: p.userId!,
          role: (p.userId === user.id ? "owner" : "editor") as const,
        })),
      );
    }

    // Update poll status
    const [updatedPoll] = await tx
      .update(schedulePolls)
      .set({
        status: "confirmed",
        confirmedOptionId: option.id,
        tripId: trip.id,
        updatedAt: new Date(),
      })
      .where(eq(schedulePolls.id, pollId))
      .returning();

    return updatedPoll;
  });

  return c.json({
    ...result,
    deadline: result.deadline?.toISOString() ?? null,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  });
});
```

**Step 5: Run tests**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: All PASS

**Step 6: Run full test suite**

Run: `bun run test`
Expected: All PASS

**Step 7: Commit**

```
feat: 日程調整の共有リンク・確定APIを追加
```

---

## Task 7: Shared Poll Routes (No Auth)

**Files:**
- Create: `apps/api/src/routes/poll-share.ts`
- Modify: `apps/api/src/app.ts`
- Add tests to `polls.integration.test.ts`

**Step 1: Write tests for shared poll access**

```typescript
// In a new describe block or within existing one
it("accesses shared poll via token", async () => {
  // Create poll and generate share token
  const createRes = await app.request("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Shared Poll",
      destination: "Tokyo",
      options: [{ startDate: "2026-08-01", endDate: "2026-08-01" }],
    }),
  });
  const poll = await createRes.json();

  const shareRes = await app.request(`/api/polls/${poll.id}/share`, { method: "POST" });
  const { shareToken } = await shareRes.json();

  // Access without auth (simulate by switching to no-auth mock)
  mockGetSession.mockImplementation(() => null);

  const res = await app.request(`/api/polls/shared/${shareToken}`);
  expect(res.status).toBe(200);
  const shared = await res.json();
  expect(shared.title).toBe("Shared Poll");
});

it("guest submits response via shared link", async () => {
  mockGetSession.mockImplementation(() => ({
    user: owner,
    session: { id: "test-session" },
  }));

  const createRes = await app.request("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Guest Poll",
      destination: "Tokyo",
      options: [{ startDate: "2026-08-01", endDate: "2026-08-01" }],
    }),
  });
  const poll = await createRes.json();

  const shareRes = await app.request(`/api/polls/${poll.id}/share`, { method: "POST" });
  const { shareToken } = await shareRes.json();

  // Guest response (no auth needed)
  mockGetSession.mockImplementation(() => null);
  const res = await app.request(`/api/polls/shared/${shareToken}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guestName: "Guest1",
      responses: [{ optionId: poll.options[0].id, response: "ok" }],
    }),
  });
  expect(res.status).toBe(200);
});
```

**Step 2: Create poll-share routes**

```typescript
// apps/api/src/routes/poll-share.ts
import { guestPollResponsesSchema } from "@sugara/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import {
  schedulePollOptions,
  schedulePollParticipants,
  schedulePollResponses,
  schedulePolls,
} from "../db/schema";
import { ERROR_MSG } from "../lib/constants";

const pollShareRoutes = new Hono();

// Get shared poll (no auth)
pollShareRoutes.get("/api/polls/shared/:token", async (c) => {
  const token = c.req.param("token");

  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.shareToken, token),
    with: {
      options: { orderBy: (o, { asc }) => [asc(o.sortOrder)] },
      participants: {
        with: {
          user: { columns: { id: true, name: true, image: true } },
          responses: true,
        },
      },
    },
  });

  if (!poll) return c.json({ error: ERROR_MSG.POLL_SHARED_NOT_FOUND }, 404);

  return c.json({
    id: poll.id,
    ownerId: poll.ownerId,
    title: poll.title,
    destination: poll.destination,
    note: poll.note,
    status: poll.status,
    deadline: poll.deadline?.toISOString() ?? null,
    confirmedOptionId: poll.confirmedOptionId,
    tripId: poll.tripId,
    options: poll.options.map((o) => ({
      id: o.id,
      startDate: o.startDate,
      endDate: o.endDate,
      sortOrder: o.sortOrder,
    })),
    participants: poll.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user?.name ?? p.guestName ?? "Guest",
      image: p.user?.image ?? null,
      responses: p.responses.map((r) => ({
        optionId: r.optionId,
        response: r.response,
      })),
    })),
    createdAt: poll.createdAt.toISOString(),
    updatedAt: poll.updatedAt.toISOString(),
  });
});

// Guest response (no auth)
pollShareRoutes.post("/api/polls/shared/:token/responses", async (c) => {
  const token = c.req.param("token");
  const body = await c.req.json();
  const parsed = guestPollResponsesSchema.safeParse(body);

  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.shareToken, token),
  });
  if (!poll) return c.json({ error: ERROR_MSG.POLL_SHARED_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);
  if (poll.deadline && poll.deadline < new Date()) {
    return c.json({ error: ERROR_MSG.POLL_DEADLINE_PASSED }, 400);
  }

  await db.transaction(async (tx) => {
    // Create guest participant
    const [participant] = await tx
      .insert(schedulePollParticipants)
      .values({ pollId: poll.id, guestName: parsed.data.guestName })
      .returning();

    if (parsed.data.responses.length > 0) {
      await tx.insert(schedulePollResponses).values(
        parsed.data.responses.map((r) => ({
          participantId: participant.id,
          optionId: r.optionId,
          response: r.response,
        })),
      );
    }
  });

  await db
    .update(schedulePolls)
    .set({ updatedAt: new Date() })
    .where(eq(schedulePolls.id, poll.id));

  return c.json({ ok: true });
});

export { pollShareRoutes };
```

**Step 3: Register in app.ts**

```typescript
import { pollShareRoutes } from "./routes/poll-share";
// ...
app.route("/", pollShareRoutes);
```

Also update the test app to include shared routes:
```typescript
// In test file createApp()
import { pollShareRoutes } from "../../routes/poll-share";

function createApp() {
  const app = new Hono();
  app.route("/api/polls", pollRoutes);
  app.route("/", pollShareRoutes);
  return app;
}
```

**Step 4: Run tests**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: All PASS

**Step 5: Commit**

```
feat: 日程調整の共有リンク経由アクセス・ゲスト回答APIを追加
```

---

## Task 8: Frontend - Query Keys, Messages, API Types

**Files:**
- Modify: `apps/web/lib/query-keys.ts`
- Modify: `apps/web/lib/messages.ts`

**Step 1: Add query keys**

Add to `queryKeys` object in `apps/web/lib/query-keys.ts`:
```typescript
polls: {
  all: ["polls"] as const,
  list: () => [...queryKeys.polls.all, "list"] as const,
  detail: (pollId: string) => [...queryKeys.polls.all, pollId] as const,
  shared: (token: string) => ["polls", "shared", token] as const,
},
```

**Step 2: Add messages**

Add to `MSG` object in `apps/web/lib/messages.ts`:
```typescript
// Poll
POLL_CREATED: "日程調整を作成しました",
POLL_CREATE_FAILED: "日程調整の作成に失敗しました",
POLL_UPDATED: "日程調整を更新しました",
POLL_UPDATE_FAILED: "日程調整の更新に失敗しました",
POLL_DELETED: "日程調整を削除しました",
POLL_DELETE_FAILED: "日程調整の削除に失敗しました",
POLL_OPTION_ADDED: "候補日を追加しました",
POLL_OPTION_ADD_FAILED: "候補日の追加に失敗しました",
POLL_OPTION_DELETED: "候補日を削除しました",
POLL_OPTION_DELETE_FAILED: "候補日の削除に失敗しました",
POLL_PARTICIPANT_ADDED: "参加者を追加しました",
POLL_PARTICIPANT_ADD_FAILED: "参加者の追加に失敗しました",
POLL_PARTICIPANT_REMOVED: "参加者を削除しました",
POLL_PARTICIPANT_REMOVE_FAILED: "参加者の削除に失敗しました",
POLL_RESPONSE_SUBMITTED: "回答を送信しました",
POLL_RESPONSE_SUBMIT_FAILED: "回答の送信に失敗しました",
POLL_CONFIRMED: "日程を確定しました",
POLL_CONFIRM_FAILED: "日程の確定に失敗しました",
POLL_CLOSED: "日程調整を終了しました",
POLL_CLOSE_FAILED: "日程調整の終了に失敗しました",
POLL_SHARE_LINK_COPIED: "共有リンクをコピーしました",
POLL_SHARE_LINK_FAILED: "共有リンクの生成に失敗しました",
POLL_GUEST_RESPONSE_SUBMITTED: "回答を送信しました",
POLL_GUEST_RESPONSE_FAILED: "回答の送信に失敗しました",
POLL_DEADLINE_PASSED: "回答締め切りを過ぎています",
```

Add to limits section:
```typescript
LIMIT_POLLS: `日程調整は最大${MAX_POLLS_PER_USER}件まで作成できます`,
LIMIT_POLL_OPTIONS: `候補日は最大${MAX_OPTIONS_PER_POLL}件まで追加できます`,
LIMIT_POLL_PARTICIPANTS: `参加者は最大${MAX_PARTICIPANTS_PER_POLL}人まで招待できます`,
```

Also add imports at the top:
```typescript
import {
  MAX_POLLS_PER_USER,
  MAX_OPTIONS_PER_POLL,
  MAX_PARTICIPANTS_PER_POLL,
} from "@sugara/shared";
```

**Step 3: Verify types compile**

Run: `bun run check-types`
Expected: PASS

**Step 4: Commit**

```
feat: 日程調整のクエリキーとメッセージ定数を追加
```

---

## Task 9: Frontend - Poll Creation Page

**Files:**
- Create: `apps/web/app/(authenticated)/polls/new/page.tsx`

**Step 1: Create poll creation page**

This page lets users set title, destination, optional note, optional deadline, and add candidate date ranges. On submit it calls `POST /api/polls` and navigates to the created poll detail.

Key UI elements:
- Title input (`#poll-title`)
- Destination input (`#poll-destination`)
- Note textarea (`#poll-note`, optional)
- Deadline datetime input (`#poll-deadline`, optional)
- Date range list with add/remove buttons
- Each date range: startDate + endDate date inputs
- Submit button

Follow the existing `CreateTripDialog` pattern for form layout but as a full page (since it has more fields).

Use `react-hook-form` or manual state (follow existing pattern - the project uses manual state with Zod validation).

**Step 2: Verify it renders**

Run: `bun run --filter @sugara/web dev` and navigate to `/polls/new`
Expected: Form renders

**Step 3: Commit**

```
feat: 日程調整作成ページを追加
```

---

## Task 10: Frontend - Poll Detail Page

**Files:**
- Create: `apps/web/app/(authenticated)/polls/[pollId]/page.tsx`
- Create: `apps/web/app/(authenticated)/polls/[pollId]/_components/response-matrix.tsx`
- Create: `apps/web/app/(authenticated)/polls/[pollId]/_components/poll-header.tsx`
- Create: `apps/web/app/(authenticated)/polls/[pollId]/_components/participant-dialog.tsx`

**Step 1: Create poll detail page**

The main page fetches poll detail with `useQuery`, shows:
- Poll header (title, destination, status badge, deadline, edit/delete for owner)
- Response matrix (main feature)
- Participant list with add button (owner only)
- Response submit button (for own responses)
- Confirm button (owner only, when status is open)
- Link to trip (when confirmed)

**Step 2: Create response matrix component**

The response matrix is the core UI - a table/grid showing:
- Columns: one per option (date range)
- Rows: one per participant
- Cells: OK / Maybe / NG (for viewing) or radio buttons (for editing own row)
- Summary row: count of OK responses per option
- Highlight columns where all participants said OK
- Mobile: horizontal scroll

**Step 3: Create participant dialog**

Reuse the pattern from `group-detail-dialog.tsx`:
- Tabs: "Friends" and "ID" for adding participants
- List current participants with remove button (owner only)
- Friend list with selection mode for bulk add

**Step 4: Verify it renders**

Run: `bun run --filter @sugara/web dev`, create a poll, navigate to it
Expected: Detail page renders with matrix

**Step 5: Commit**

```
feat: 日程調整詳細ページと回答マトリクスを追加
```

---

## Task 11: Frontend - Shared Poll Page

**Files:**
- Create: `apps/web/app/polls/shared/[token]/page.tsx`

Note: This is outside `(authenticated)` layout since it doesn't require auth.

**Step 1: Create shared poll page**

- Fetches poll via `GET /api/polls/shared/:token` (no auth)
- Shows the same response matrix (read-only for existing responses)
- Guest form: name input + response selection for each option
- Submit calls `POST /api/polls/shared/:token/responses`
- After submit, show a success message

**Step 2: Verify it renders**

Create a poll, generate share link, open in incognito
Expected: Shared page renders, guest can submit responses

**Step 3: Commit**

```
feat: 日程調整の共有リンクページを追加
```

---

## Task 12: Frontend - Home Page Integration

**Files:**
- Create: `apps/web/components/poll-card.tsx`
- Modify: `apps/web/app/(authenticated)/home/page.tsx`

**Step 1: Create PollCard component**

Follows the same pattern as `TripCard`:
- Title, destination
- "日程調整中" / "確定" / "終了" badge
- Response status: `${respondedCount}/${participantCount}人回答済`
- Deadline: relative time or "締め切り済み" or nothing
- Click navigates to `/polls/[pollId]`

**Step 2: Modify home page**

- Fetch polls alongside trips: `useQuery({ queryKey: queryKeys.polls.list(), queryFn: ... })`
- "新規作成" button becomes a dropdown with 2 options:
  - "旅行を作成": Opens `CreateTripDialog` (existing)
  - "日程調整から始める": Navigates to `/polls/new`
- Merge polls and trips by `updatedAt` into a single list
- Each item renders as `TripCard` or `PollCard` based on type
- Add "日程調整中" to status filter options

**Step 3: Verify it renders**

Run dev server, create a poll, check home page
Expected: Poll appears in the list alongside trips

**Step 4: Commit**

```
feat: ホーム画面に日程調整カードを統合表示
```

---

## Task 13: Type Check, Lint, Full Test Suite

**Step 1: Run type check**

Run: `bun run check-types`
Expected: PASS

**Step 2: Run lint and format**

Run: `bun run check`
Expected: PASS (fix any issues)

**Step 3: Run full test suite**

Run: `bun run test`
Expected: All PASS

**Step 4: Push schema**

Run: `bun run db:push`
Expected: Schema up to date

**Step 5: Final commit if any fixes**

```
fix: 日程調整機能のlint・型エラーを修正
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Shared schemas, types, limits | `packages/shared/src/schemas/poll.ts`, types.ts, limits.ts |
| 2 | DB schema (4 tables + relations) | `apps/api/src/db/schema.ts` |
| 3 | API constants + access helper | `apps/api/src/lib/constants.ts`, poll-access.ts |
| 4 | Poll CRUD routes + tests | `apps/api/src/routes/polls.ts`, tests |
| 5 | Options/participants/responses API + tests | polls.ts (additional routes) |
| 6 | Share link + confirm API + tests | polls.ts, tests |
| 7 | Shared poll routes (no auth) | `apps/api/src/routes/poll-share.ts` |
| 8 | Frontend query keys + messages | query-keys.ts, messages.ts |
| 9 | Poll creation page | `/polls/new/page.tsx` |
| 10 | Poll detail page + response matrix | `/polls/[pollId]/page.tsx` + components |
| 11 | Shared poll page | `/polls/shared/[token]/page.tsx` |
| 12 | Home page integration | poll-card.tsx, home/page.tsx |
| 13 | Final verification | Type check, lint, tests |
