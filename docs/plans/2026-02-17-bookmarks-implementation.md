# Bookmarks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add trip-independent bookmark lists with public profile pages.

**Architecture:** New `bookmark_lists` + `bookmarks` tables, separate API routes (`/api/bookmark-lists`, `/api/users/:userId/bookmark-lists`), new frontend pages (`/bookmarks`, `/users/:userId`). No dependencies on existing trip/schedule system.

**Tech Stack:** Drizzle ORM, Hono, Zod, React Query, shadcn/ui

---

### Task 1: Shared schemas, types, and limits

**Files:**
- Create: `packages/shared/src/schemas/bookmark.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/limits.ts`

**Step 1: Create Zod schemas**

Create `packages/shared/src/schemas/bookmark.ts`:

```typescript
import { z } from "zod";

export const bookmarkListVisibilitySchema = z.enum(["private", "public"]);
export type BookmarkListVisibility = z.infer<typeof bookmarkListVisibilitySchema>;

export const createBookmarkListSchema = z.object({
  name: z.string().min(1).max(100),
  visibility: bookmarkListVisibilitySchema.default("private"),
});

export const updateBookmarkListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  visibility: bookmarkListVisibilitySchema.optional(),
});

export const reorderBookmarkListsSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

export const createBookmarkSchema = z.object({
  name: z.string().min(1).max(200),
  memo: z.string().max(2000).nullish(),
  url: z
    .string()
    .max(2000)
    .url()
    .refine((v) => /^https?:\/\//.test(v), { message: "HTTP(S) URL required" })
    .nullish(),
});

export const updateBookmarkSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  memo: z.string().max(2000).nullish(),
  url: z
    .string()
    .max(2000)
    .url()
    .refine((v) => /^https?:\/\//.test(v), { message: "HTTP(S) URL required" })
    .nullish(),
});

export const reorderBookmarksSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});
```

**Step 2: Export from schemas index**

Add to `packages/shared/src/schemas/index.ts`:

```typescript
export * from "./bookmark";
```

**Step 3: Add response types**

Add to `packages/shared/src/types.ts`:

```typescript
import type { BookmarkListVisibility } from "./schemas/bookmark";

export type BookmarkListResponse = {
  id: string;
  name: string;
  visibility: BookmarkListVisibility;
  sortOrder: number;
  bookmarkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkResponse = {
  id: string;
  name: string;
  memo?: string | null;
  url?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkListDetailResponse = BookmarkListResponse & {
  bookmarks: BookmarkResponse[];
};

export type PublicProfileResponse = {
  id: string;
  name: string;
  image?: string | null;
  bookmarkLists: BookmarkListResponse[];
};
```

**Step 4: Add limits**

Add to `packages/shared/src/limits.ts`:

```typescript
export const MAX_BOOKMARK_LISTS_PER_USER = 5;
export const MAX_BOOKMARKS_PER_LIST = 20;
```

**Step 5: Run type check**

Run: `bun run --filter @sugara/shared check-types`
Expected: PASS

---

### Task 2: DB schema

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: Add enum and tables**

Add after the existing enum definitions (around line 50):

```typescript
export const bookmarkListVisibilityEnum = pgEnum("bookmark_list_visibility", [
  "private",
  "public",
]);
```

Add after existing table definitions:

```typescript
export const bookmarkLists = pgTable(
  "bookmark_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    visibility: bookmarkListVisibilityEnum("visibility").notNull().default("private"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("bookmark_lists_user_sort_idx").on(table.userId, table.sortOrder)],
).enableRLS();

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => bookmarkLists.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    memo: text("memo"),
    url: varchar("url", { length: 2000 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("bookmarks_list_sort_idx").on(table.listId, table.sortOrder)],
).enableRLS();
```

**Step 2: Add relations**

Add after existing relation definitions:

```typescript
export const bookmarkListsRelations = relations(bookmarkLists, ({ one, many }) => ({
  user: one(users, { fields: [bookmarkLists.userId], references: [users.id] }),
  bookmarks: many(bookmarks),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  list: one(bookmarkLists, { fields: [bookmarks.listId], references: [bookmarkLists.id] }),
}));
```

**Step 3: Push schema to local DB**

Run: `bun run db:push`
Expected: Tables created successfully

**Step 4: Run type check**

Run: `bun run --filter @sugara/api check-types`
Expected: PASS

---

### Task 3: API routes - bookmark lists (with tests)

**Files:**
- Create: `apps/api/src/routes/bookmark-lists.ts`
- Create: `apps/api/src/__tests__/bookmark-lists.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/lib/constants.ts`

**Step 1: Add error messages**

Add to `apps/api/src/lib/constants.ts`:

```typescript
BOOKMARK_LIST_NOT_FOUND: "Bookmark list not found",
LIMIT_BOOKMARK_LISTS: "Bookmark list limit reached",
LIMIT_BOOKMARKS: "Bookmark limit reached",
```

**Step 2: Write failing tests**

Create `apps/api/src/__tests__/bookmark-lists.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbDelete, mockDbUpdate, mockDbSelect } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockDbQuery: {
      bookmarkLists: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbSelect: vi.fn(),
  }));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

import { MAX_BOOKMARK_LISTS_PER_USER } from "@sugara/shared";
import { bookmarkListRoutes } from "../routes/bookmark-lists";

const userId = "00000000-0000-0000-0000-000000000001";
const otherUserId = "00000000-0000-0000-0000-000000000002";
const fakeUser = { id: userId, name: "Test User", email: "test@sugara.local" };
const listId = "00000000-0000-0000-0000-000000000010";

describe("Bookmark list routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });
  });

  // --- GET /api/bookmark-lists ---
  describe("GET /api/bookmark-lists", () => {
    it("returns own lists", async () => {
      mockDbQuery.bookmarkLists.findMany.mockResolvedValue([
        { id: listId, name: "Tokyo Cafes", visibility: "private", sortOrder: 0, userId, createdAt: new Date(), updatedAt: new Date(), bookmarks: [{ id: "b1" }] },
      ]);

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Tokyo Cafes");
      expect(body[0].bookmarkCount).toBe(1);
    });

    it("returns 401 when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists");

      expect(res.status).toBe(401);
    });
  });

  // --- POST /api/bookmark-lists ---
  describe("POST /api/bookmark-lists", () => {
    it("creates list with 201", async () => {
      const created = { id: listId, name: "Tokyo Cafes", visibility: "private", sortOrder: 0, userId, createdAt: new Date(), updatedAt: new Date() };
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([created]),
        }),
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tokyo Cafes" }),
      });

      expect(res.status).toBe(201);
    });

    it("returns 400 with empty name", async () => {
      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 when list limit reached", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: MAX_BOOKMARK_LISTS_PER_USER }]),
        }),
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request("/api/bookmark-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New List" }),
      });

      expect(res.status).toBe(409);
    });
  });

  // --- PATCH /api/bookmark-lists/:listId ---
  describe("PATCH /api/bookmark-lists/:listId", () => {
    it("updates list name", async () => {
      const existing = { id: listId, userId, name: "Old", visibility: "private" };
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, name: "New" };
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 404 when list not found", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when not owner (security)", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({ id: listId, userId: otherUserId });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hack" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // --- DELETE /api/bookmark-lists/:listId ---
  describe("DELETE /api/bookmark-lists/:listId", () => {
    it("deletes own list", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({ id: listId, userId });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, { method: "DELETE" });

      expect(res.status).toBe(200);
    });

    it("returns 404 when not owner", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({ id: listId, userId: otherUserId });

      const app = createTestApp(bookmarkListRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}`, { method: "DELETE" });

      expect(res.status).toBe(404);
    });
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- bookmark-lists`
Expected: FAIL (module not found)

**Step 4: Implement bookmark list routes**

Create `apps/api/src/routes/bookmark-lists.ts`:

```typescript
import {
  createBookmarkListSchema,
  MAX_BOOKMARK_LISTS_PER_USER,
  reorderBookmarkListsSchema,
  updateBookmarkListSchema,
} from "@sugara/shared";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { bookmarkLists } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const bookmarkListRoutes = new Hono<AppEnv>();
bookmarkListRoutes.use("*", requireAuth);

// List own bookmark lists
bookmarkListRoutes.get("/", async (c) => {
  const user = c.get("user");

  const lists = await db.query.bookmarkLists.findMany({
    where: eq(bookmarkLists.userId, user.id),
    orderBy: bookmarkLists.sortOrder,
    with: { bookmarks: { columns: { id: true } } },
  });

  return c.json(
    lists.map((l) => ({
      id: l.id,
      name: l.name,
      visibility: l.visibility,
      sortOrder: l.sortOrder,
      bookmarkCount: l.bookmarks.length,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  );
});

// Create bookmark list
bookmarkListRoutes.post("/", async (c) => {
  const user = c.get("user");

  const body = await c.req.json();
  const parsed = createBookmarkListSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [{ count: listCount }] = await db
    .select({ count: count() })
    .from(bookmarkLists)
    .where(eq(bookmarkLists.userId, user.id));

  if (listCount >= MAX_BOOKMARK_LISTS_PER_USER) {
    return c.json({ error: ERROR_MSG.LIMIT_BOOKMARK_LISTS }, 409);
  }

  const [created] = await db
    .insert(bookmarkLists)
    .values({
      userId: user.id,
      name: parsed.data.name,
      visibility: parsed.data.visibility,
      sortOrder: listCount,
    })
    .returning();

  return c.json(created, 201);
});

// Update bookmark list
bookmarkListRoutes.patch("/:listId", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const body = await c.req.json();
  const parsed = updateBookmarkListSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.bookmarkLists.findFirst({
    where: and(eq(bookmarkLists.id, listId)),
  });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);
  }

  const [updated] = await db
    .update(bookmarkLists)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(bookmarkLists.id, listId))
    .returning();

  return c.json(updated);
});

// Reorder bookmark lists
bookmarkListRoutes.patch("/reorder", async (c) => {
  const user = c.get("user");

  const body = await c.req.json();
  const parsed = reorderBookmarkListsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const lists = await db.query.bookmarkLists.findMany({
    where: eq(bookmarkLists.userId, user.id),
    columns: { id: true },
  });
  const ownIds = new Set(lists.map((l) => l.id));
  const allOwned = parsed.data.orderedIds.every((id) => ownIds.has(id));
  if (!allOwned) {
    return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 400);
  }

  await Promise.all(
    parsed.data.orderedIds.map((id, i) =>
      db
        .update(bookmarkLists)
        .set({ sortOrder: i })
        .where(eq(bookmarkLists.id, id)),
    ),
  );

  return c.json({ ok: true });
});

// Delete bookmark list (cascades bookmarks)
bookmarkListRoutes.delete("/:listId", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const existing = await db.query.bookmarkLists.findFirst({
    where: eq(bookmarkLists.id, listId),
  });
  if (!existing || existing.userId !== user.id) {
    return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);
  }

  await db.delete(bookmarkLists).where(eq(bookmarkLists.id, listId));

  return c.json({ ok: true });
});

export { bookmarkListRoutes };
```

**Step 5: Register routes in app.ts**

Add to `apps/api/src/app.ts`:

```typescript
import { bookmarkListRoutes } from "./routes/bookmark-lists";

app.route("/api/bookmark-lists", bookmarkListRoutes);
```

**Step 6: Run tests**

Run: `bun run --filter @sugara/api test -- bookmark-lists`
Expected: PASS

---

### Task 4: API routes - bookmarks (with tests)

**Files:**
- Create: `apps/api/src/routes/bookmarks.ts`
- Create: `apps/api/src/__tests__/bookmarks.test.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Write failing tests**

Create `apps/api/src/__tests__/bookmarks.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const { mockGetSession, mockDbQuery, mockDbInsert, mockDbDelete, mockDbUpdate, mockDbSelect } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockDbQuery: {
      bookmarkLists: { findFirst: vi.fn() },
      bookmarks: { findMany: vi.fn(), findFirst: vi.fn() },
    },
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbSelect: vi.fn(),
  }));

vi.mock("../lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

import { MAX_BOOKMARKS_PER_LIST } from "@sugara/shared";
import { bookmarkRoutes } from "../routes/bookmarks";

const userId = "00000000-0000-0000-0000-000000000001";
const otherUserId = "00000000-0000-0000-0000-000000000002";
const fakeUser = { id: userId, name: "Test User", email: "test@sugara.local" };
const listId = "00000000-0000-0000-0000-000000000010";
const bookmarkId = "00000000-0000-0000-0000-000000000020";

describe("Bookmark routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: fakeUser, session: { id: "session-1" } });
    // Default: list belongs to user
    mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({ id: listId, userId });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });
  });

  // --- GET /api/bookmark-lists/:listId/bookmarks ---
  describe("GET bookmarks", () => {
    it("returns bookmarks for own list", async () => {
      mockDbQuery.bookmarks.findMany.mockResolvedValue([
        { id: bookmarkId, name: "Cafe A", memo: null, url: null, sortOrder: 0, listId, createdAt: new Date(), updatedAt: new Date() },
      ]);

      const app = createTestApp(bookmarkRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/bookmarks`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Cafe A");
    });

    it("returns 404 when list not owned", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({ id: listId, userId: otherUserId });

      const app = createTestApp(bookmarkRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/bookmarks`);

      expect(res.status).toBe(404);
    });
  });

  // --- POST /api/bookmark-lists/:listId/bookmarks ---
  describe("POST bookmark", () => {
    it("creates bookmark with 201", async () => {
      const created = { id: bookmarkId, name: "Cafe A", memo: null, url: null, sortOrder: 0, listId };
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([created]),
        }),
      });

      const app = createTestApp(bookmarkRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Cafe A" }),
      });

      expect(res.status).toBe(201);
    });

    it("returns 409 when bookmark limit reached", async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: MAX_BOOKMARKS_PER_LIST }]),
        }),
      });

      const app = createTestApp(bookmarkRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 400 with empty name", async () => {
      const app = createTestApp(bookmarkRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      });

      expect(res.status).toBe(400);
    });
  });

  // --- PATCH /api/bookmark-lists/:listId/bookmarks/:bookmarkId ---
  describe("PATCH bookmark", () => {
    it("updates bookmark", async () => {
      const existing = { id: bookmarkId, listId, name: "Old" };
      mockDbQuery.bookmarks.findFirst.mockResolvedValue(existing);
      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ ...existing, name: "New" }]),
          }),
        }),
      });

      const app = createTestApp(bookmarkRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/bookmarks/${bookmarkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      });

      expect(res.status).toBe(200);
    });

    it("returns 404 when bookmark not found", async () => {
      mockDbQuery.bookmarks.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(bookmarkRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/bookmarks/${bookmarkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // --- DELETE /api/bookmark-lists/:listId/bookmarks/:bookmarkId ---
  describe("DELETE bookmark", () => {
    it("deletes bookmark", async () => {
      mockDbQuery.bookmarks.findFirst.mockResolvedValue({ id: bookmarkId, listId });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createTestApp(bookmarkRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/bookmarks/${bookmarkId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
    });

    it("returns 404 when bookmark not found", async () => {
      mockDbQuery.bookmarks.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(bookmarkRoutes, "/api/bookmark-lists");
      const res = await app.request(`/api/bookmark-lists/${listId}/bookmarks/${bookmarkId}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- bookmarks.test`
Expected: FAIL

**Step 3: Implement bookmark routes**

Create `apps/api/src/routes/bookmarks.ts`:

```typescript
import {
  createBookmarkSchema,
  MAX_BOOKMARKS_PER_LIST,
  reorderBookmarksSchema,
  updateBookmarkSchema,
} from "@sugara/shared";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { bookmarkLists, bookmarks } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const bookmarkRoutes = new Hono<AppEnv>();
bookmarkRoutes.use("*", requireAuth);

// Verify list ownership middleware-style helper
async function verifyListOwnership(listId: string, userId: string) {
  const list = await db.query.bookmarkLists.findFirst({
    where: eq(bookmarkLists.id, listId),
  });
  if (!list || list.userId !== userId) return null;
  return list;
}

// List bookmarks
bookmarkRoutes.get("/:listId/bookmarks", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const items = await db.query.bookmarks.findMany({
    where: eq(bookmarks.listId, listId),
    orderBy: bookmarks.sortOrder,
  });

  return c.json(items);
});

// Create bookmark
bookmarkRoutes.post("/:listId/bookmarks", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const body = await c.req.json();
  const parsed = createBookmarkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [{ count: bmCount }] = await db
    .select({ count: count() })
    .from(bookmarks)
    .where(eq(bookmarks.listId, listId));

  if (bmCount >= MAX_BOOKMARKS_PER_LIST) {
    return c.json({ error: ERROR_MSG.LIMIT_BOOKMARKS }, 409);
  }

  const [created] = await db
    .insert(bookmarks)
    .values({
      listId,
      name: parsed.data.name,
      memo: parsed.data.memo ?? null,
      url: parsed.data.url ?? null,
      sortOrder: bmCount,
    })
    .returning();

  return c.json(created, 201);
});

// Update bookmark
bookmarkRoutes.patch("/:listId/bookmarks/:bookmarkId", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");
  const bookmarkId = c.req.param("bookmarkId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const body = await c.req.json();
  const parsed = updateBookmarkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.listId, listId)),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);
  }

  const [updated] = await db
    .update(bookmarks)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(bookmarks.id, bookmarkId))
    .returning();

  return c.json(updated);
});

// Reorder bookmarks
bookmarkRoutes.patch("/:listId/bookmarks/reorder", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const body = await c.req.json();
  const parsed = reorderBookmarksSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const items = await db.query.bookmarks.findMany({
    where: eq(bookmarks.listId, listId),
    columns: { id: true },
  });
  const ownIds = new Set(items.map((b) => b.id));
  const allOwned = parsed.data.orderedIds.every((id) => ownIds.has(id));
  if (!allOwned) {
    return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 400);
  }

  await Promise.all(
    parsed.data.orderedIds.map((id, i) =>
      db.update(bookmarks).set({ sortOrder: i }).where(eq(bookmarks.id, id)),
    ),
  );

  return c.json({ ok: true });
});

// Delete bookmark
bookmarkRoutes.delete("/:listId/bookmarks/:bookmarkId", async (c) => {
  const user = c.get("user");
  const listId = c.req.param("listId");
  const bookmarkId = c.req.param("bookmarkId");

  const list = await verifyListOwnership(listId, user.id);
  if (!list) return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);

  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, bookmarkId), eq(bookmarks.listId, listId)),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);
  }

  await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId));

  return c.json({ ok: true });
});

export { bookmarkRoutes };
```

**Step 4: Register in app.ts**

Add to `apps/api/src/app.ts`:

```typescript
import { bookmarkRoutes } from "./routes/bookmarks";

app.route("/api/bookmark-lists", bookmarkRoutes);
```

**Step 5: Run tests**

Run: `bun run --filter @sugara/api test -- bookmarks.test`
Expected: PASS

---

### Task 5: API routes - public profile (with tests)

**Files:**
- Create: `apps/api/src/routes/profile.ts`
- Create: `apps/api/src/__tests__/profile.test.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Write failing tests**

Create `apps/api/src/__tests__/profile.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const { mockDbQuery } = vi.hoisted(() => ({
  mockDbQuery: {
    users: { findFirst: vi.fn() },
    bookmarkLists: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

// No auth mock needed - public routes
vi.mock("../db/index", () => ({
  db: { query: mockDbQuery },
}));

import { profileRoutes } from "../routes/profile";

const userId = "00000000-0000-0000-0000-000000000001";
const listId = "00000000-0000-0000-0000-000000000010";

describe("Profile routes (public)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/users/:userId/bookmark-lists", () => {
    it("returns public lists with bookmark counts", async () => {
      mockDbQuery.users.findFirst.mockResolvedValue({ id: userId, name: "Alice", image: null });
      mockDbQuery.bookmarkLists.findMany.mockResolvedValue([
        { id: listId, name: "Tokyo", visibility: "public", sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), bookmarks: [{ id: "b1" }, { id: "b2" }] },
      ]);

      const app = createTestApp(profileRoutes, "/api/users");
      const res = await app.request(`/api/users/${userId}/bookmark-lists`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("Alice");
      expect(body.bookmarkLists).toHaveLength(1);
      expect(body.bookmarkLists[0].bookmarkCount).toBe(2);
    });

    it("returns 404 when user not found", async () => {
      mockDbQuery.users.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(profileRoutes, "/api/users");
      const res = await app.request(`/api/users/${userId}/bookmark-lists`);

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/users/:userId/bookmark-lists/:listId", () => {
    it("returns public list with bookmarks", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({
        id: listId,
        userId,
        name: "Tokyo",
        visibility: "public",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        bookmarks: [{ id: "b1", name: "Cafe A", memo: null, url: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() }],
      });

      const app = createTestApp(profileRoutes, "/api/users");
      const res = await app.request(`/api/users/${userId}/bookmark-lists/${listId}`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.name).toBe("Tokyo");
      expect(body.bookmarks).toHaveLength(1);
    });

    it("returns 404 for private list", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue({
        id: listId,
        userId,
        visibility: "private",
      });

      const app = createTestApp(profileRoutes, "/api/users");
      const res = await app.request(`/api/users/${userId}/bookmark-lists/${listId}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 when list not found", async () => {
      mockDbQuery.bookmarkLists.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(profileRoutes, "/api/users");
      const res = await app.request(`/api/users/${userId}/bookmark-lists/${listId}`);

      expect(res.status).toBe(404);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- profile`
Expected: FAIL

**Step 3: Implement profile routes**

Create `apps/api/src/routes/profile.ts`:

```typescript
import { eq, and } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { bookmarkLists, users } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";

const profileRoutes = new Hono();

// Public profile: list public bookmark lists
profileRoutes.get("/:userId/bookmark-lists", async (c) => {
  const userId = c.req.param("userId");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, name: true, image: true },
  });
  if (!user) {
    return c.json({ error: ERROR_MSG.USER_NOT_FOUND }, 404);
  }

  const lists = await db.query.bookmarkLists.findMany({
    where: and(eq(bookmarkLists.userId, userId), eq(bookmarkLists.visibility, "public")),
    orderBy: bookmarkLists.sortOrder,
    with: { bookmarks: { columns: { id: true } } },
  });

  return c.json({
    id: user.id,
    name: user.name,
    image: user.image,
    bookmarkLists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      visibility: l.visibility,
      sortOrder: l.sortOrder,
      bookmarkCount: l.bookmarks.length,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  });
});

// Public: single list with bookmarks
profileRoutes.get("/:userId/bookmark-lists/:listId", async (c) => {
  const listId = c.req.param("listId");

  const list = await db.query.bookmarkLists.findFirst({
    where: eq(bookmarkLists.id, listId),
    with: { bookmarks: { orderBy: (b, { asc }) => [asc(b.sortOrder)] } },
  });

  if (!list || list.visibility !== "public") {
    return c.json({ error: ERROR_MSG.BOOKMARK_LIST_NOT_FOUND }, 404);
  }

  return c.json({
    id: list.id,
    name: list.name,
    visibility: list.visibility,
    sortOrder: list.sortOrder,
    bookmarkCount: list.bookmarks.length,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    bookmarks: list.bookmarks,
  });
});

export { profileRoutes };
```

**Step 4: Register in app.ts**

Add to `apps/api/src/app.ts`:

```typescript
import { profileRoutes } from "./routes/profile";

app.route("/api/users", profileRoutes);
```

**Step 5: Run tests**

Run: `bun run --filter @sugara/api test -- profile`
Expected: PASS

**Step 6: Run all API tests**

Run: `bun run --filter @sugara/api test`
Expected: ALL PASS

---

### Task 6: Frontend - query keys, messages, navigation

**Files:**
- Modify: `apps/web/lib/query-keys.ts`
- Modify: `apps/web/lib/messages.ts`
- Modify: `apps/web/lib/nav-links.ts`

**Step 1: Add query keys**

Add to `apps/web/lib/query-keys.ts`:

```typescript
bookmarks: {
  all: ["bookmarks"] as const,
  lists: () => [...queryKeys.bookmarks.all, "lists"] as const,
  list: (listId: string) => [...queryKeys.bookmarks.all, "list", listId] as const,
},
profile: {
  bookmarkLists: (userId: string) => ["profile", userId, "bookmark-lists"] as const,
  bookmarkList: (userId: string, listId: string) => ["profile", userId, "bookmark-lists", listId] as const,
},
```

**Step 2: Add messages**

Add to `apps/web/lib/messages.ts`:

```typescript
// Bookmark
BOOKMARK_LIST_CREATED: "リストを作成しました",
BOOKMARK_LIST_CREATE_FAILED: "リストの作成に失敗しました",
BOOKMARK_LIST_UPDATED: "リストを更新しました",
BOOKMARK_LIST_UPDATE_FAILED: "リストの更新に失敗しました",
BOOKMARK_LIST_DELETED: "リストを削除しました",
BOOKMARK_LIST_DELETE_FAILED: "リストの削除に失敗しました",
BOOKMARK_ADDED: "ブックマークを追加しました",
BOOKMARK_ADD_FAILED: "ブックマークの追加に失敗しました",
BOOKMARK_UPDATED: "ブックマークを更新しました",
BOOKMARK_UPDATE_FAILED: "ブックマークの更新に失敗しました",
BOOKMARK_DELETED: "ブックマークを削除しました",
BOOKMARK_DELETE_FAILED: "ブックマークの削除に失敗しました",
BOOKMARK_REORDER_FAILED: "並び替えに失敗しました",
LIMIT_BOOKMARK_LISTS: `リストは最大${MAX_BOOKMARK_LISTS_PER_USER}件まで作成できます`,
LIMIT_BOOKMARKS: `ブックマークは1リストあたり最大${MAX_BOOKMARKS_PER_LIST}件まで追加できます`,
PROFILE_FETCH_FAILED: "プロフィールの取得に失敗しました",
```

**Step 3: Add navigation link**

Add to `apps/web/lib/nav-links.ts`:

```typescript
import { Bookmark, Home, UserPlus } from "lucide-react";

export const NAV_LINKS = [
  { href: "/home", label: "ホーム", icon: Home },
  { href: "/bookmarks", label: "ブックマーク", icon: Bookmark },
  { href: "/friends", label: "フレンド", icon: UserPlus },
] as const;
```

---

### Task 7: Frontend - bookmarks management page

**Files:**
- Create: `apps/web/app/(authenticated)/bookmarks/page.tsx`

This is the main bookmarks management page with list sidebar and bookmark content area. Implementation details depend on existing component patterns in the project (dialogs, cards, etc.). Build incrementally:

1. Basic page shell with list sidebar
2. Create/edit list dialog
3. Bookmark list display
4. Add/edit bookmark dialog
5. Delete functionality
6. Visibility toggle

**Run type check after each sub-step:**
Run: `bun run check-types`

---

### Task 8: Frontend - public profile page

**Files:**
- Create: `apps/web/app/users/[userId]/page.tsx`

Public profile page (outside authenticated layout). Shows user name, avatar, and public bookmark lists.

**Note:** This page is outside the `(authenticated)` group since it doesn't require login.

---

### Task 9: Full verification

**Step 1: Run all tests**

Run: `bun run test`
Expected: ALL PASS

**Step 2: Run lint and type check**

Run: `bun run check && bun run check-types`
Expected: ALL PASS

**Step 3: Run dev server and manual verification**

Run: `bun run --filter @sugara/web dev`
Verify:
- /bookmarks page loads
- Can create/edit/delete lists
- Can add/edit/delete bookmarks
- Visibility toggle works
- /users/:userId shows public lists
- Navigation link appears in header
