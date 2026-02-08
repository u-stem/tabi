# Phase 2: Remaining Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** MVP残りの6機能を順番に実装する: スポットD&D並び替えUI、旅行ステータス変更UI、trip_members権限管理、統合テスト、フロントエンドテスト、マイグレーションファイル生成

**Architecture:** 既存のHono API + Next.js App Routerの構成を維持。D&Dには@dnd-kitを採用(React 19対応、react-beautiful-dndは非推奨)。trip_members権限はDB既存テーブルを活用し、ownerIdチェックからtrip_membersベースのアクセス制御へ移行。テストはvitest + @testing-library/reactで統一。

**Tech Stack:** @dnd-kit/core, @dnd-kit/sortable, @testing-library/react, @testing-library/jest-dom, jsdom, vitest

---

## Task 1: Spot Drag & Drop Reorder UI

Reorder API (`PATCH /:tripId/days/:dayId/spots/reorder`) は実装済み。フロントエンドのD&D UIを追加する。

**Files:**
- Modify: `apps/web/package.json` (add @dnd-kit dependencies)
- Modify: `apps/web/components/day-timeline.tsx` (wrap with DndContext + SortableContext)
- Modify: `apps/web/components/spot-item.tsx` (make draggable with useSortable)

**Step 1: Install @dnd-kit packages**

Run: `bun add --filter @tabi/web @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: packages added to apps/web/package.json

**Step 2: Make SpotItem sortable**

Modify `apps/web/components/spot-item.tsx`:

```tsx
// Add id prop and drag handle
// Wrap with useSortable from @dnd-kit/sortable
// Add CSS.Transform for visual feedback
// Add drag handle (grip icon) on left side
```

Add `id: string` to SpotItemProps. Use `useSortable({ id })` hook. Apply transform/transition styles. Add a grip handle element before the category badge.

**Step 3: Add DnD to DayTimeline**

Modify `apps/web/components/day-timeline.tsx`:

```tsx
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"; // from @dnd-kit/core or modifiers if needed

// Wrap spots list in:
// <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
//   <SortableContext items={spots.map(s => s.id)} strategy={verticalListSortingStrategy}>
//     {spots.map(...)}
//   </SortableContext>
// </DndContext>

// handleDragEnd: compute new order, call reorder API
async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const oldIndex = spots.findIndex((s) => s.id === active.id);
  const newIndex = spots.findIndex((s) => s.id === over.id);
  // Use arrayMove from @dnd-kit/sortable
  const reordered = arrayMove(spots, oldIndex, newIndex);
  const spotIds = reordered.map((s) => s.id);

  try {
    await api(`/api/trips/${tripId}/days/${dayId}/spots/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ spotIds }),
    });
    onRefresh();
  } catch {
    toast.error("並び替えに失敗しました");
  }
}
```

**Step 4: Verify**

Run: `bun run check-types`
Run: `bun run lint`
Expected: No errors

**Step 5: Manual test**

Run: `bun run dev` and verify spots can be dragged to reorder within a day.

**Step 6: Commit**

```bash
git add apps/web/package.json apps/web/components/day-timeline.tsx apps/web/components/spot-item.tsx bun.lock
git commit -m "feat: スポットのドラッグ&ドロップ並び替えUI"
```

---

## Task 2: Trip Status Change UI

`updateTripSchema` は `status` フィールドを許容しており、PATCH `/api/trips/:id` で更新可能。ただし現在のAPIはdate変更を拒否するが status 変更は通る。TripActionsにステータス変更UIを追加する。

**Files:**
- Modify: `apps/web/components/trip-actions.tsx` (add status selector)
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx` (pass onRefresh to TripActions)

**Step 1: Write the failing test (API side)**

`apps/api/src/__tests__/trips.test.ts` の PATCH テストに status 変更テストを追加:

```typescript
it("returns updated trip when changing status", async () => {
  const updated = { id: "trip-1", title: "Tokyo Trip", ownerId: fakeUser.id, status: "planned" };
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([updated]),
      }),
    }),
  });

  const app = createApp();
  const res = await app.request("/api/trips/trip-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "planned" }),
  });
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.status).toBe("planned");
});
```

**Step 2: Run test to verify it passes**

Run: `bun run --filter @tabi/api test`
Expected: PASS (API already supports status changes)

**Step 3: Add status selector to TripActions**

Modify `apps/web/components/trip-actions.tsx`:

- Import `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@/components/ui/select`
- Import `STATUS_LABELS` from `@tabi/shared`
- Replace the static Badge with a Select that calls PATCH API on change
- Add `onStatusChange` callback prop

```tsx
type TripActionsProps = {
  tripId: string;
  status: string;
  onStatusChange?: () => void;
};

// Inside component:
const statuses = Object.entries(STATUS_LABELS) as [string, string][];

async function handleStatusChange(newStatus: string) {
  try {
    await api(`/api/trips/${tripId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    toast.success("ステータスを変更しました");
    onStatusChange?.();
  } catch {
    toast.error("ステータスの変更に失敗しました");
  }
}

// Replace Badge with:
<Select value={status} onValueChange={handleStatusChange}>
  <SelectTrigger className="w-[130px] h-8 text-xs">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {statuses.map(([value, label]) => (
      <SelectItem key={value} value={value}>{label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Step 4: Pass onRefresh to TripActions**

Modify `apps/web/app/(authenticated)/trips/[id]/page.tsx`:

```tsx
<TripActions tripId={tripId} status={trip.status} onStatusChange={fetchTrip} />
```

**Step 5: Verify**

Run: `bun run check-types`
Run: `bun run lint`
Expected: No errors

**Step 6: Commit**

```bash
git add apps/web/components/trip-actions.tsx apps/web/app/\(authenticated\)/trips/\[id\]/page.tsx apps/api/src/__tests__/trips.test.ts
git commit -m "feat: 旅行ステータス変更UI"
```

---

## Task 3: trip_members Permission Management

現在すべてのアクセス制御は `trips.ownerId` で行われている。trip_membersテーブル (owner/editor/viewer ロール) は存在するが未活用。段階的に移行する。

### Task 3a: Update Access Control to Use trip_members

**Files:**
- Create: `apps/api/src/lib/permissions.ts` (shared helper)
- Modify: `apps/api/src/routes/trips.ts` (use trip_members for access)
- Modify: `apps/api/src/routes/spots.ts` (use trip_members for access)
- Modify: `apps/api/src/routes/share.ts` (owner-only check)
- Test: `apps/api/src/__tests__/permissions.test.ts`

**Step 1: Write the failing test for permissions helper**

Create `apps/api/src/__tests__/permissions.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

const mockDbQuery = vi.hoisted(() => ({
  tripMembers: { findFirst: vi.fn() },
}));

vi.mock("../db/index", () => ({
  db: { query: mockDbQuery },
}));

import { checkTripAccess } from "../lib/permissions";

describe("checkTripAccess", () => {
  it("returns role when user is a member", async () => {
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId: "trip-1",
      userId: "user-1",
      role: "editor",
    });
    const result = await checkTripAccess("trip-1", "user-1");
    expect(result).toBe("editor");
  });

  it("returns null when user is not a member", async () => {
    mockDbQuery.tripMembers.findFirst.mockResolvedValue(undefined);
    const result = await checkTripAccess("trip-1", "user-1");
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter @tabi/api test`
Expected: FAIL - module not found

**Step 3: Implement permissions helper**

Create `apps/api/src/lib/permissions.ts`:

```typescript
import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import { tripMembers } from "../db/schema";

export type MemberRole = "owner" | "editor" | "viewer";

export async function checkTripAccess(
  tripId: string,
  userId: string,
): Promise<MemberRole | null> {
  const member = await db.query.tripMembers.findFirst({
    where: and(
      eq(tripMembers.tripId, tripId),
      eq(tripMembers.userId, userId),
    ),
  });
  return member?.role ?? null;
}

export function canEdit(role: MemberRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function isOwner(role: MemberRole | null): boolean {
  return role === "owner";
}
```

**Step 4: Run test to verify it passes**

Run: `bun run --filter @tabi/api test`
Expected: PASS

**Step 5: Update trips.ts to use trip_members**

Update access checks in `apps/api/src/routes/trips.ts`:

- GET `/`: Query trips where user is a member (not just owner)
- GET `/:id`: Check trip_members access
- PATCH `/:id`: Check canEdit (owner or editor)
- DELETE `/:id`: Check isOwner (owner only)

Key changes:
```typescript
// GET / - list trips where user is a member
import { checkTripAccess, canEdit, isOwner } from "../lib/permissions";

// GET /
const memberTrips = await db.query.tripMembers.findMany({
  where: eq(tripMembers.userId, user.id),
  with: {
    trip: {
      with: {
        days: {
          with: { spots: { columns: { id: true } } },
        },
      },
    },
  },
});
const result = memberTrips.map(({ trip }) => {
  const { days, ...rest } = trip;
  return {
    ...rest,
    totalSpots: days.reduce((sum, day) => sum + day.spots.length, 0),
  };
});

// GET /:id - any member can view
const role = await checkTripAccess(tripId, user.id);
if (!role) return c.json({ error: "Trip not found" }, 404);

// PATCH /:id - owner or editor
const role = await checkTripAccess(tripId, user.id);
if (!canEdit(role)) return c.json({ error: "Trip not found" }, 404);

// DELETE /:id - owner only
const role = await checkTripAccess(tripId, user.id);
if (!isOwner(role)) return c.json({ error: "Trip not found" }, 404);
```

**Step 6: Update spots.ts verifyDayOwnership**

Modify `apps/api/src/routes/spots.ts`:

```typescript
import { checkTripAccess, canEdit } from "../lib/permissions";

async function verifyDayOwnership(tripId: string, dayId: string, userId: string): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const role = await checkTripAccess(tripId, userId);
  return canEdit(role);
}
```

**Step 7: Update share.ts**

Share creation should remain owner-only. Update to use `isOwner(checkTripAccess(...))`.

**Step 8: Update existing tests**

Update mock data in all test files to include tripMembers query mock. Ensure existing tests still pass.

**Step 9: Run all tests**

Run: `bun run --filter @tabi/api test`
Expected: All tests pass

**Step 10: Commit**

```bash
git add apps/api/src/lib/permissions.ts apps/api/src/__tests__/permissions.test.ts apps/api/src/routes/trips.ts apps/api/src/routes/spots.ts apps/api/src/routes/share.ts apps/api/src/__tests__/trips.test.ts apps/api/src/__tests__/spots.test.ts apps/api/src/__tests__/share.test.ts
git commit -m "refactor: アクセス制御をtrip_membersベースに移行"
```

### Task 3b: Member Management API

**Files:**
- Create: `apps/api/src/routes/members.ts`
- Modify: `apps/api/src/app.ts` (register member routes)
- Create: `packages/shared/src/schemas/member.ts` (validation schema)
- Modify: `packages/shared/src/schemas/index.ts` (export)
- Test: `apps/api/src/__tests__/members.test.ts`

**Step 1: Write validation schema**

Create `packages/shared/src/schemas/member.ts`:

```typescript
import { z } from "zod";

export const memberRoleSchema = z.enum(["editor", "viewer"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: memberRoleSchema,
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: memberRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
```

Update `packages/shared/src/schemas/index.ts` to export member schemas.

**Step 2: Write failing tests**

Create `apps/api/src/__tests__/members.test.ts` with tests for:
- `GET /api/trips/:id/members` - list members (any member can view)
- `POST /api/trips/:id/members` - add member by email (owner only)
- `PATCH /api/trips/:id/members/:userId` - update role (owner only)
- `DELETE /api/trips/:id/members/:userId` - remove member (owner only, cannot remove self)
- 401 for unauthenticated
- 404 for non-member accessing trip
- 403 for editor trying to manage members

**Step 3: Implement member routes**

Create `apps/api/src/routes/members.ts`:

```typescript
import { addMemberSchema, updateMemberRoleSchema } from "@tabi/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { tripMembers, users } from "../db/schema";
import { checkTripAccess, isOwner } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const memberRoutes = new Hono<AppEnv>();
memberRoutes.use("*", requireAuth);

// List members
memberRoutes.get("/:tripId/members", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const role = await checkTripAccess(tripId, user.id);
  if (!role) return c.json({ error: "Trip not found" }, 404);

  const members = await db.query.tripMembers.findMany({
    where: eq(tripMembers.tripId, tripId),
    with: { user: { columns: { id: true, name: true, email: true } } },
  });
  return c.json(members.map((m) => ({
    userId: m.userId,
    role: m.role,
    name: m.user.name,
    email: m.user.email,
  })));
});

// Add member
memberRoutes.post("/:tripId/members", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const role = await checkTripAccess(tripId, user.id);
  if (!isOwner(role)) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const targetUser = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  });
  if (!targetUser) return c.json({ error: "User not found" }, 404);

  // Check if already a member
  const existing = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUser.id)),
  });
  if (existing) return c.json({ error: "Already a member" }, 409);

  await db.insert(tripMembers).values({
    tripId,
    userId: targetUser.id,
    role: parsed.data.role,
  });
  return c.json({ ok: true }, 201);
});

// Update member role
memberRoutes.patch("/:tripId/members/:userId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const targetUserId = c.req.param("userId");
  const role = await checkTripAccess(tripId, user.id);
  if (!isOwner(role)) return c.json({ error: "Forbidden" }, 403);

  // Cannot change owner's role
  if (targetUserId === user.id) return c.json({ error: "Cannot change own role" }, 400);

  const body = await c.req.json();
  const parsed = updateMemberRoleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const existing = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)),
  });
  if (!existing) return c.json({ error: "Member not found" }, 404);

  await db.update(tripMembers)
    .set({ role: parsed.data.role })
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)));
  return c.json({ ok: true });
});

// Remove member
memberRoutes.delete("/:tripId/members/:userId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const targetUserId = c.req.param("userId");
  const role = await checkTripAccess(tripId, user.id);
  if (!isOwner(role)) return c.json({ error: "Forbidden" }, 403);

  if (targetUserId === user.id) return c.json({ error: "Cannot remove yourself" }, 400);

  await db.delete(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)));
  return c.json({ ok: true });
});

export { memberRoutes };
```

Register in `apps/api/src/app.ts`:
```typescript
import { memberRoutes } from "./routes/members";
// ...
app.route("/api/trips", memberRoutes);
```

**Step 4: Run all tests**

Run: `bun run --filter @tabi/api test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/shared/src/schemas/member.ts packages/shared/src/schemas/index.ts apps/api/src/routes/members.ts apps/api/src/app.ts apps/api/src/__tests__/members.test.ts
git commit -m "feat: メンバー管理API"
```

### Task 3c: Member Management UI

**Files:**
- Create: `apps/web/components/member-dialog.tsx` (member management dialog)
- Modify: `apps/web/components/trip-actions.tsx` (add members button)
- Modify: `packages/shared/src/types.ts` (add MemberResponse type)

**Step 1: Add type**

Add to `packages/shared/src/types.ts`:

```typescript
export type MemberResponse = {
  userId: string;
  role: string;
  name: string;
  email: string;
};
```

**Step 2: Create MemberDialog component**

Create `apps/web/components/member-dialog.tsx`:
- List current members with role badges
- Input to add by email + role select
- Owner can change roles (Select) and remove members (X button)
- Owner cannot remove themselves

**Step 3: Add to TripActions**

Add a "Members" button in TripActions that opens MemberDialog.

**Step 4: Verify**

Run: `bun run check-types`
Run: `bun run lint`

**Step 5: Commit**

```bash
git add apps/web/components/member-dialog.tsx apps/web/components/trip-actions.tsx packages/shared/src/types.ts
git commit -m "feat: メンバー管理UI"
```

---

## Task 4: Integration Tests

既存の placeholder 統合テストを実装する。テスト用DBを使い、実際のHTTPリクエストでAPI全体を検証。

**Files:**
- Modify: `apps/api/src/__tests__/integration/setup.ts` (enhance setup/teardown)
- Modify: `apps/api/src/__tests__/integration/trips.integration.test.ts` (implement)
- Create: `apps/api/src/__tests__/integration/spots.integration.test.ts`
- Modify: `docker-compose.yml` (add test DB)

**Step 1: Add test DB to docker-compose**

Modify `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tabi
      POSTGRES_PASSWORD: tabi
      POSTGRES_DB: tabi
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  db-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tabi
      POSTGRES_PASSWORD: tabi
      POSTGRES_DB: tabi_test
    ports:
      - "5433:5432"
    volumes:
      - pgdata_test:/var/lib/postgresql/data

volumes:
  pgdata:
  pgdata_test:
```

**Step 2: Enhance integration test setup**

Modify `apps/api/src/__tests__/integration/setup.ts`:

```typescript
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgresql://tabi:tabi@localhost:5433/tabi_test";

export async function setupTestDb() {
  const client = postgres(TEST_DB_URL);
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function cleanTestDb(db: ReturnType<typeof drizzle<typeof schema>>) {
  // Delete in reverse dependency order
  await db.delete(schema.spots);
  await db.delete(schema.tripDays);
  await db.delete(schema.tripMembers);
  await db.delete(schema.trips);
  await db.delete(schema.sessions);
  await db.delete(schema.accounts);
  await db.delete(schema.verifications);
  await db.delete(schema.users);
}

export async function teardownTestDb(client: ReturnType<typeof postgres>) {
  await client.end();
}
```

**Step 3: Write trip integration tests**

Test the full flow: create user -> create trip -> verify trip_days and trip_members auto-created -> get trip -> update -> delete.

**Step 4: Write spot integration tests**

Test: create user -> create trip -> add spot -> reorder -> update spot -> delete spot.

**Step 5: Run integration tests**

Need to push schema to test DB first:
Run: `TEST_DATABASE_URL=postgresql://tabi:tabi@localhost:5433/tabi_test bun run --filter @tabi/api db:push`
Run: `bun run --filter @tabi/api test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add docker-compose.yml apps/api/src/__tests__/integration/
git commit -m "test: 統合テストの実装"
```

---

## Task 5: Frontend Tests

vitest + @testing-library/react + jsdom でフロントエンドコンポーネントテストを追加。

**Files:**
- Modify: `apps/web/package.json` (add test dependencies)
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/__tests__/setup.ts` (test setup)
- Create: `apps/web/__tests__/components/trip-card.test.tsx`
- Create: `apps/web/__tests__/components/spot-item.test.tsx`
- Create: `apps/web/__tests__/lib/format.test.ts`

**Step 1: Install test dependencies**

Run: `bun add -D --filter @tabi/web vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`

**Step 2: Configure vitest**

Create `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./__tests__/setup.ts"],
    include: ["./__tests__/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@tabi/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
```

Create `apps/web/__tests__/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Add test script to `apps/web/package.json`:

```json
"test": "vitest run --passWithNoTests"
```

**Step 3: Write format utility tests**

Create `apps/web/__tests__/lib/format.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { formatDate, formatDateRange, getDayCount } from "../../lib/format";

describe("formatDate", () => {
  it("formats YYYY-MM-DD to Japanese format", () => {
    expect(formatDate("2025-07-01")).toBe("2025年7月1日");
  });
  it("handles December correctly", () => {
    expect(formatDate("2025-12-25")).toBe("2025年12月25日");
  });
});

describe("formatDateRange", () => {
  it("formats date range", () => {
    expect(formatDateRange("2025-07-01", "2025-07-03")).toBe(
      "2025年7月1日 - 2025年7月3日"
    );
  });
});

describe("getDayCount", () => {
  it("returns 1 for same day", () => {
    expect(getDayCount("2025-07-01", "2025-07-01")).toBe(1);
  });
  it("returns 3 for 3-day trip", () => {
    expect(getDayCount("2025-07-01", "2025-07-03")).toBe(3);
  });
});
```

**Step 4: Write TripCard component test**

Create `apps/web/__tests__/components/trip-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TripCard } from "../../components/trip-card";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("TripCard", () => {
  const defaultProps = {
    id: "trip-1",
    title: "Tokyo Trip",
    destination: "Tokyo",
    startDate: "2025-07-01",
    endDate: "2025-07-03",
    status: "draft",
    totalSpots: 5,
  };

  it("renders trip title", () => {
    render(<TripCard {...defaultProps} />);
    expect(screen.getByText("Tokyo Trip")).toBeInTheDocument();
  });

  it("shows destination when different from title", () => {
    render(<TripCard {...defaultProps} />);
    expect(screen.getByText("Tokyo")).toBeInTheDocument();
  });

  it("hides destination when same as title", () => {
    render(<TripCard {...defaultProps} destination="Tokyo Trip" />);
    expect(screen.queryByText("Tokyo Trip")).toBeInTheDocument(); // only title
  });

  it("shows spot count", () => {
    render(<TripCard {...defaultProps} />);
    expect(screen.getByText("5件のスポット")).toBeInTheDocument();
  });

  it("shows empty spot message when zero", () => {
    render(<TripCard {...defaultProps} totalSpots={0} />);
    expect(screen.getByText("スポット未登録")).toBeInTheDocument();
  });

  it("links to trip detail page", () => {
    render(<TripCard {...defaultProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/trips/trip-1");
  });
});
```

**Step 5: Write SpotItem component test**

Create `apps/web/__tests__/components/spot-item.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpotItem } from "../../components/spot-item";

describe("SpotItem", () => {
  const defaultProps = {
    name: "Tokyo Tower",
    category: "sightseeing" as const,
    onDelete: vi.fn(),
  };

  it("renders spot name", () => {
    render(<SpotItem {...defaultProps} />);
    expect(screen.getByText("Tokyo Tower")).toBeInTheDocument();
  });

  it("renders category label in Japanese", () => {
    render(<SpotItem {...defaultProps} />);
    expect(screen.getByText("観光")).toBeInTheDocument();
  });

  it("renders time range when both provided", () => {
    render(<SpotItem {...defaultProps} startTime="10:00" endTime="12:00" />);
    expect(screen.getByText("10:00 - 12:00")).toBeInTheDocument();
  });

  it("renders address when provided", () => {
    render(<SpotItem {...defaultProps} address="Minato, Tokyo" />);
    expect(screen.getByText("Minato, Tokyo")).toBeInTheDocument();
  });

  it("renders URL as link when provided", () => {
    render(<SpotItem {...defaultProps} url="https://example.com" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com");
  });
});
```

**Step 6: Run frontend tests**

Run: `bun run --filter @tabi/web test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/__tests__/ bun.lock
git commit -m "test: フロントエンドテスト基盤とコンポーネントテスト追加"
```

---

## Task 6: Migration Files

現在は `db:push` のみ使用。マイグレーションファイルを生成してバージョン管理に含める。

**Files:**
- Generate: `apps/api/drizzle/` (migration files)

**Step 1: Generate migration files**

Run: `bun run db:generate`
Expected: `apps/api/drizzle/` に SQL マイグレーションファイルが生成される

**Step 2: Verify migration files**

Check generated files in `apps/api/drizzle/` - SQL should match current schema.

**Step 3: Test migration (optional)**

Against test DB:
Run: `TEST_DATABASE_URL=... bun run --filter @tabi/api db:migrate`
Expected: Migration applies cleanly

**Step 4: Add .gitkeep if drizzle dir was gitignored**

Check `.gitignore` to ensure `drizzle/` is not ignored.

**Step 5: Commit**

```bash
git add apps/api/drizzle/
git commit -m "chore: マイグレーションファイル生成"
```
