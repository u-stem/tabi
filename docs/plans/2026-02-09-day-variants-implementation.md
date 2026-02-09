# Day Patterns Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add condition-based plan branching at the day level, allowing each trip_day to have multiple patterns (e.g., "sunny", "rainy") with independent spot sets.

**Architecture:** Insert a `day_patterns` layer between `trip_days` and `spots`. Each trip_day gets a default pattern on creation. Spots now belong to a pattern instead of directly to a day. Frontend uses tabs to switch patterns.

**Tech Stack:** Drizzle ORM (PostgreSQL), Hono, Zod, React (Next.js 15), Tailwind CSS v4, shadcn/ui

**Design doc:** `docs/plans/2026-02-09-day-patterns-design.md`

---

## Task 1: Add day-pattern Zod schemas to shared package

**Files:**
- Create: `packages/shared/src/schemas/day-pattern.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Create the schema file**

```typescript
// packages/shared/src/schemas/day-pattern.ts
import { z } from "zod";

export const createDayPatternSchema = z.object({
  label: z.string().min(1).max(50),
});
export type CreateDayPatternInput = z.infer<typeof createDayPatternSchema>;

export const updateDayPatternSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateDayPatternInput = z.infer<typeof updateDayPatternSchema>;
```

**Step 2: Export from schemas index**

Add to `packages/shared/src/schemas/index.ts`:
```typescript
export * from "./day-pattern";
```

**Step 3: Verify build**

Run: `bun run --filter @tabi/shared check-types`
Expected: PASS

**Step 4: Commit**

```
feat: add day-pattern Zod schemas
```

---

## Task 2: Update shared response types

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add DayPatternResponse and update DayResponse**

```typescript
// Add after SpotResponse
export type DayPatternResponse = {
  id: string;
  label: string;
  isDefault: boolean;
  sortOrder: number;
  spots: SpotResponse[];
};

// Replace existing DayResponse
export type DayResponse = {
  id: string;
  dayNumber: number;
  date: string;
  memo?: string | null;
  patterns: DayPatternResponse[];
};
```

Remove `spots: SpotResponse[]` from DayResponse and replace with `patterns: DayPatternResponse[]`.

**Step 2: Verify build (expect type errors in consumers - that's OK for now)**

Run: `bun run --filter @tabi/shared check-types`
Expected: PASS (shared package itself should compile)

**Step 3: Commit**

```
feat: add DayPatternResponse type, update DayResponse
```

---

## Task 3: Update DB schema

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: Add dayPatterns table after tripDays (around line 139)**

```typescript
export const dayPatterns = pgTable("day_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripDayId: uuid("trip_day_id")
    .notNull()
    .references(() => tripDays.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 50 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Step 2: Change spots FK from tripDayId to dayPatternId**

In the `spots` table, replace:
```typescript
tripDayId: uuid("trip_day_id")
  .notNull()
  .references(() => tripDays.id, { onDelete: "cascade" }),
```
with:
```typescript
dayPatternId: uuid("day_pattern_id")
  .notNull()
  .references(() => dayPatterns.id, { onDelete: "cascade" }),
```

**Step 3: Update relations**

Replace `tripDaysRelations`:
```typescript
export const tripDaysRelations = relations(tripDays, ({ one, many }) => ({
  trip: one(trips, { fields: [tripDays.tripId], references: [trips.id] }),
  patterns: many(dayPatterns),
}));
```

Add `dayPatternsRelations`:
```typescript
export const dayPatternsRelations = relations(dayPatterns, ({ one, many }) => ({
  tripDay: one(tripDays, { fields: [dayPatterns.tripDayId], references: [tripDays.id] }),
  spots: many(spots),
}));
```

Replace `spotsRelations`:
```typescript
export const spotsRelations = relations(spots, ({ one }) => ({
  dayPattern: one(dayPatterns, { fields: [spots.dayPatternId], references: [dayPatterns.id] }),
}));
```

**Step 4: Push schema to dev DB**

Run: `bun run db:push`
Expected: Schema pushed (may need to recreate tables if column rename fails)

If push fails due to existing data, run:
```
bun run db:push --force
bun run db:seed
```

**Step 5: Commit**

```
feat: add day_patterns table, move spots FK to day_patterns
```

---

## Task 4: Update trip creation to auto-create default patterns

**Files:**
- Modify: `apps/api/src/routes/trips.ts`
- Test: `apps/api/src/__tests__/trips.test.ts`
- Test: `apps/api/src/__tests__/integration/trips.integration.test.ts`

**Step 1: Write failing unit test**

In `trips.test.ts`, find the trip creation test and update the mock setup. Add `dayPatterns` to mockDbQuery and mockDbInsert. Add a test that verifies `dayPatterns` insertion is called after `tripDays` insertion.

The test should verify:
- `db.insert(dayPatterns)` is called with values containing `{ tripDayId, label: "default", isDefault: true, sortOrder: 0 }` for each created trip_day.

**Step 2: Run test to verify it fails**

Run: `bun run --filter @tabi/api test`
Expected: FAIL

**Step 3: Update trips.ts**

Import `dayPatterns` from schema:
```typescript
import { dayPatterns, tripDays, tripMembers, trips } from "../db/schema";
```

In the `POST /` handler, after inserting trip_days (line 87-94), add pattern creation:

```typescript
// Auto-create trip days based on date range
const dates = generateDateRange(startDate, endDate);
if (dates.length > 0) {
  const insertedDays = await tx
    .insert(tripDays)
    .values(
      dates.map((date, i) => ({
        tripId: created.id,
        date,
        dayNumber: i + 1,
      })),
    )
    .returning({ id: tripDays.id });

  // Create default pattern for each day
  await tx.insert(dayPatterns).values(
    insertedDays.map((day) => ({
      tripDayId: day.id,
      label: "default",
      isDefault: true,
      sortOrder: 0,
    })),
  );
}
```

Note: The existing code does NOT `.returning()` on the tripDays insert. We need to add `.returning({ id: tripDays.id })` to get the IDs.

**Step 4: Run test to verify it passes**

Run: `bun run --filter @tabi/api test`
Expected: PASS

**Step 5: Update trip date change handler**

In the `PATCH /:id` handler, find the section where new days are inserted (around line 213-222). After inserting new days, also create default patterns:

```typescript
// Insert new days
const datesToInsert = newDates.filter((d) => !existingDateSet.has(d));
if (datesToInsert.length > 0) {
  const newDays = await tx
    .insert(tripDays)
    .values(
      datesToInsert.map((date) => ({
        tripId,
        date,
        dayNumber: 0, // Will be corrected below
      })),
    )
    .returning({ id: tripDays.id });

  // Create default pattern for each new day
  await tx.insert(dayPatterns).values(
    newDays.map((day) => ({
      tripDayId: day.id,
      label: "default",
      isDefault: true,
      sortOrder: 0,
    })),
  );
}
```

**Step 6: Run all tests**

Run: `bun run --filter @tabi/api test`
Expected: PASS

**Step 7: Commit**

```
feat: auto-create default pattern when creating trip days
```

---

## Task 5: Update trip detail query to include patterns

**Files:**
- Modify: `apps/api/src/routes/trips.ts`
- Test: `apps/api/src/__tests__/trips.test.ts`

**Step 1: Write failing test**

Update the trip detail GET test to expect `patterns` nested inside each day instead of `spots`.

**Step 2: Run test to verify it fails**

Run: `bun run --filter @tabi/api test`
Expected: FAIL

**Step 3: Update GET /:id query**

Change the `with` clause (trips.ts around line 122-131):

```typescript
const trip = await db.query.trips.findFirst({
  where: eq(trips.id, tripId),
  with: {
    days: {
      orderBy: (days, { asc }) => [asc(days.dayNumber)],
      with: {
        patterns: {
          orderBy: (patterns, { asc }) => [asc(patterns.sortOrder)],
          with: {
            spots: {
              orderBy: (spots, { asc }) => [asc(spots.sortOrder)],
            },
          },
        },
      },
    },
  },
});
```

**Step 4: Update trip list query**

In `GET /` (trip list), the `totalSpots` calculation needs to traverse through patterns:

```typescript
const result = memberships.map(({ trip }) => {
  const { days, ...rest } = trip;
  return {
    ...rest,
    totalSpots: days.reduce(
      (sum, day) =>
        sum + day.patterns.reduce((vSum, pattern) => vSum + pattern.spots.length, 0),
      0,
    ),
  };
});
```

And update the `with` query for trip list:
```typescript
with: {
  trip: {
    with: {
      days: {
        with: {
          patterns: {
            with: { spots: { columns: { id: true } } },
          },
        },
      },
    },
  },
},
```

**Step 5: Run tests**

Run: `bun run --filter @tabi/api test`
Expected: PASS

**Step 6: Commit**

```
feat: include patterns in trip detail/list queries
```

---

## Task 6: Create pattern CRUD routes

**Files:**
- Create: `apps/api/src/routes/patterns.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/__tests__/patterns.test.ts`

**Step 1: Write failing unit tests**

Create `apps/api/src/__tests__/patterns.test.ts` following the same mock pattern as `spots.test.ts`:

Tests to write:
1. `GET /:tripId/days/:dayId/patterns` - returns patterns for a day
2. `POST /:tripId/days/:dayId/patterns` - creates pattern with label
3. `POST` with empty label returns 400
4. `PATCH /:tripId/days/:dayId/patterns/:patternId` - updates label
5. `DELETE /:tripId/days/:dayId/patterns/:patternId` - deletes non-default pattern
6. `DELETE` on default pattern returns 400
7. All endpoints return 404 for unauthorized users

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @tabi/api test`
Expected: FAIL

**Step 3: Implement pattern routes**

Create `apps/api/src/routes/patterns.ts`:

```typescript
import { createDayPatternSchema, updateDayPatternSchema } from "@tabi/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { dayPatterns, spots, tripDays } from "../db/schema";
import { canEdit, checkTripAccess } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const patternRoutes = new Hono<AppEnv>();
patternRoutes.use("*", requireAuth);

async function verifyDayAccess(tripId: string, dayId: string, userId: string): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const role = await checkTripAccess(tripId, userId);
  return role !== null;
}

async function verifyDayEditAccess(tripId: string, dayId: string, userId: string): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const role = await checkTripAccess(tripId, userId);
  return canEdit(role);
}

// List patterns for a day
patternRoutes.get("/:tripId/days/:dayId/patterns", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");

  if (!(await verifyDayAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const patterns = await db.query.dayPatterns.findMany({
    where: eq(dayPatterns.tripDayId, dayId),
    orderBy: (v, { asc }) => [asc(v.sortOrder)],
    with: {
      spots: {
        orderBy: (s, { asc }) => [asc(s.sortOrder)],
      },
    },
  });
  return c.json(patterns);
});

// Create pattern
patternRoutes.post("/:tripId/days/:dayId/patterns", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = createDayPatternSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  // Get next sort order
  const existing = await db.query.dayPatterns.findMany({
    where: eq(dayPatterns.tripDayId, dayId),
    columns: { sortOrder: true },
  });
  const maxOrder = existing.reduce((max, v) => Math.max(max, v.sortOrder), -1);

  const [pattern] = await db
    .insert(dayPatterns)
    .values({
      tripDayId: dayId,
      label: parsed.data.label,
      isDefault: false,
      sortOrder: maxOrder + 1,
    })
    .returning();

  return c.json(pattern, 201);
});

// Update pattern
patternRoutes.patch("/:tripId/days/:dayId/patterns/:patternId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = updateDayPatternSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
  });
  if (!existing) {
    return c.json({ error: "Variant not found" }, 404);
  }

  const [updated] = await db
    .update(dayPatterns)
    .set(parsed.data)
    .where(eq(dayPatterns.id, patternId))
    .returning();

  return c.json(updated);
});

// Delete pattern (default cannot be deleted)
patternRoutes.delete("/:tripId/days/:dayId/patterns/:patternId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const existing = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
  });
  if (!existing) {
    return c.json({ error: "Variant not found" }, 404);
  }
  if (existing.isDefault) {
    return c.json({ error: "Cannot delete default pattern" }, 400);
  }

  await db.delete(dayPatterns).where(eq(dayPatterns.id, patternId));
  return c.json({ ok: true });
});

// Duplicate pattern (with spots)
patternRoutes.post("/:tripId/days/:dayId/patterns/:patternId/duplicate", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const dayId = c.req.param("dayId");
  const patternId = c.req.param("patternId");

  if (!(await verifyDayEditAccess(tripId, dayId, user.id))) {
    return c.json({ error: "Trip not found" }, 404);
  }

  const source = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
    with: { spots: true },
  });
  if (!source) {
    return c.json({ error: "Variant not found" }, 404);
  }

  // Get next sort order
  const existing = await db.query.dayPatterns.findMany({
    where: eq(dayPatterns.tripDayId, dayId),
    columns: { sortOrder: true },
  });
  const maxOrder = existing.reduce((max, v) => Math.max(max, v.sortOrder), -1);

  const result = await db.transaction(async (tx) => {
    const [newVariant] = await tx
      .insert(dayPatterns)
      .values({
        tripDayId: dayId,
        label: `${source.label} (copy)`,
        isDefault: false,
        sortOrder: maxOrder + 1,
      })
      .returning();

    if (source.spots.length > 0) {
      await tx.insert(spots).values(
        source.spots.map((spot) => ({
          dayPatternId: newVariant.id,
          name: spot.name,
          category: spot.category,
          address: spot.address,
          latitude: spot.latitude,
          longitude: spot.longitude,
          startTime: spot.startTime,
          endTime: spot.endTime,
          sortOrder: spot.sortOrder,
          memo: spot.memo,
          url: spot.url,
          departurePlace: spot.departurePlace,
          arrivalPlace: spot.arrivalPlace,
          transportMethod: spot.transportMethod,
          color: spot.color,
        })),
      );
    }

    return newVariant;
  });

  return c.json(result, 201);
});

export { patternRoutes };
```

**Step 4: Register routes in app.ts**

Add to `apps/api/src/app.ts`:
```typescript
import { patternRoutes } from "./routes/patterns";
// ...
app.route("/api/trips", patternRoutes);
```

**Step 5: Run tests**

Run: `bun run --filter @tabi/api test`
Expected: PASS

**Step 6: Commit**

```
feat: add pattern CRUD API routes
```

---

## Task 7: Update spots routes for new URL pattern

**Files:**
- Modify: `apps/api/src/routes/spots.ts`
- Modify: `apps/api/src/__tests__/spots.test.ts`
- Modify: `apps/api/src/__tests__/integration/spots.integration.test.ts`

**Step 1: Update unit tests**

In `spots.test.ts`:
- Change `basePath` from `/:tripId/days/:dayId/spots` to `/:tripId/days/:dayId/patterns/:patternId/spots`
- Add `dayPatterns` to mockDbQuery
- Update `verifyDayAccess`/`verifyDayEditAccess` expectations to also check pattern belongs to day
- Update the mock setup to include pattern validation

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @tabi/api test`
Expected: FAIL

**Step 3: Update spots.ts**

Change the route paths and update access verification:

```typescript
import { dayPatterns, spots, tripDays } from "../db/schema";

// Verify pattern belongs to day, day belongs to trip, user has access
async function verifyVariantAccess(
  tripId: string,
  dayId: string,
  patternId: string,
  userId: string,
): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const pattern = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
  });
  if (!pattern) return false;
  const role = await checkTripAccess(tripId, userId);
  return role !== null;
}

async function verifyVariantEditAccess(
  tripId: string,
  dayId: string,
  patternId: string,
  userId: string,
): Promise<boolean> {
  const day = await db.query.tripDays.findFirst({
    where: and(eq(tripDays.id, dayId), eq(tripDays.tripId, tripId)),
  });
  if (!day) return false;
  const pattern = await db.query.dayPatterns.findFirst({
    where: and(eq(dayPatterns.id, patternId), eq(dayPatterns.tripDayId, dayId)),
  });
  if (!pattern) return false;
  const role = await checkTripAccess(tripId, userId);
  return canEdit(role);
}
```

Update all route paths:
- `/:tripId/days/:dayId/spots` -> `/:tripId/days/:dayId/patterns/:patternId/spots`
- `/:tripId/days/:dayId/spots/reorder` -> `/:tripId/days/:dayId/patterns/:patternId/spots/reorder`
- `/:tripId/days/:dayId/spots/:spotId` -> `/:tripId/days/:dayId/patterns/:patternId/spots/:spotId`

Update all handlers to:
- Get `patternId` from params: `const patternId = c.req.param("patternId");`
- Use `verifyVariantAccess`/`verifyVariantEditAccess` instead of `verifyDayAccess`/`verifyDayEditAccess`
- Replace `spots.tripDayId` with `spots.dayPatternId` in all queries
- Use `patternId` instead of `dayId` for spot FK

**Step 4: Run tests**

Run: `bun run --filter @tabi/api test`
Expected: PASS

**Step 5: Update integration tests**

In `spots.integration.test.ts`:
- After creating trip and getting dayId, also get the default pattern ID from trip detail
- Update all API paths to include patternId
- Update setup to register pattern routes too

**Step 6: Run integration tests**

Run: `bun run --filter @tabi/api test:integration`
Expected: PASS (requires running PostgreSQL)

**Step 7: Commit**

```
feat: update spots routes to use pattern-scoped URLs
```

---

## Task 8: Update share route

**Files:**
- Modify: `apps/api/src/routes/share.ts`
- Modify: `apps/api/src/__tests__/share.test.ts`

**Step 1: Write failing test**

Update share test to expect `patterns` inside each day instead of `spots`.

**Step 2: Run test to verify it fails**

Run: `bun run --filter @tabi/api test`
Expected: FAIL

**Step 3: Update share.ts query**

In the `GET /api/shared/:token` handler, update the `with` clause:

```typescript
const trip = await db.query.trips.findFirst({
  where: eq(trips.shareToken, token),
  with: {
    days: {
      orderBy: (days, { asc }) => [asc(days.dayNumber)],
      with: {
        patterns: {
          orderBy: (patterns, { asc }) => [asc(patterns.sortOrder)],
          with: {
            spots: {
              orderBy: (spots, { asc }) => [asc(spots.sortOrder)],
            },
          },
        },
      },
    },
  },
});
```

**Step 4: Run tests**

Run: `bun run --filter @tabi/api test`
Expected: PASS

**Step 5: Commit**

```
feat: include patterns in shared trip response
```

---

## Task 9: Update seed script

**Files:**
- Modify: `apps/api/src/db/seed.ts` (if it exists)

**Step 1: Check if seed script exists and update it**

The seed script needs to:
1. Create day_patterns for each trip_day
2. Assign spots to day_patterns instead of trip_days
3. Optionally create a second pattern for one day to demonstrate the feature

**Step 2: Run seed**

Run: `bun run db:seed`
Expected: PASS

**Step 3: Commit**

```
chore: update seed script for day patterns
```

---

## Task 10: Update cleanup in integration test setup

**Files:**
- Modify: `apps/api/src/__tests__/integration/setup.ts`

**Step 1: Add day_patterns to TRUNCATE**

```typescript
await db.execute(
  sql`TRUNCATE spots, day_patterns, trip_days, trip_members, trips, verifications, accounts, sessions, users CASCADE`,
);
```

**Step 2: Run integration tests**

Run: `bun run --filter @tabi/api test:integration`
Expected: PASS

**Step 3: Commit**

```
chore: add day_patterns to integration test cleanup
```

---

## Task 11: Run full backend check

**Step 1: Run all tests**

Run: `bun run test`
Expected: PASS

**Step 2: Run lint**

Run: `bun run check`
Expected: PASS

**Step 3: Run type check**

Run: `bun run check-types`
Expected: Frontend will have type errors (DayResponse changed). That's expected - we fix those next.

**Step 4: Commit if any fixes were needed**

---

## Task 12: Update frontend trip detail page for patterns

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`
- Modify: `apps/web/components/day-timeline.tsx`

**Step 1: Update trip detail page**

The key change: each day now has `patterns` instead of `spots`. We need:
- A `selectedVariant` state per day (or a map of dayId -> selectedVariantIndex)
- Variant tabs below the day tabs (only shown when 2+ patterns exist)
- Pass the selected pattern's data to DayTimeline

Update `page.tsx`:

```typescript
const [selectedVariant, setSelectedVariant] = useState<Record<string, number>>({});

// Helper to get selected pattern index for current day
const currentDay = trip.days[selectedDay];
const currentVariantIndex = selectedVariant[currentDay?.id] ?? 0;
const currentVariant = currentDay?.patterns[currentVariantIndex];
```

Add pattern tabs after the day tabs:
```tsx
{currentDay && currentDay.patterns.length > 1 && (
  <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="pattern tabs">
    {currentDay.patterns.map((pattern, index) => (
      <button
        key={pattern.id}
        type="button"
        role="tab"
        aria-selected={currentVariantIndex === index}
        onClick={() =>
          setSelectedVariant((prev) => ({ ...prev, [currentDay.id]: index }))
        }
        className={cn(
          "relative shrink-0 px-3 py-1.5 text-xs font-medium transition-colors",
          currentVariantIndex === index
            ? "text-blue-600 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {pattern.label === "default" ? "default" : pattern.label}
      </button>
    ))}
    {online && <AddPatternButton tripId={tripId} dayId={currentDay.id} onAdd={fetchTrip} />}
  </div>
)}
```

Update the DayTimeline props:
```tsx
{currentVariant && (
  <DayTimeline
    key={currentVariant.id}
    tripId={tripId}
    dayId={currentDay.id}
    patternId={currentVariant.id}
    date={currentDay.date}
    spots={currentVariant.spots}
    onRefresh={fetchTrip}
    disabled={!online}
  />
)}
```

**Step 2: Update DayTimeline to accept patternId**

Add `patternId` to props and update all API paths:

```typescript
type DayTimelineProps = {
  tripId: string;
  dayId: string;
  patternId: string;
  date: string;
  spots: SpotResponse[];
  onRefresh: () => void;
  disabled?: boolean;
};
```

Update API paths in handlers:
- Delete: `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/${spotId}`
- Reorder: `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/reorder`

**Step 3: Verify build**

Run: `bun run check-types`
Expected: May still have errors in other components

**Step 4: Commit**

```
feat: add pattern tabs to trip detail page
```

---

## Task 13: Update add/edit spot dialogs

**Files:**
- Modify: `apps/web/components/add-spot-dialog.tsx`
- Modify: `apps/web/components/edit-spot-dialog.tsx`

**Step 1: Add patternId prop to AddSpotDialog**

Update props to include `patternId: string` and change the API path:

```typescript
type AddSpotDialogProps = {
  tripId: string;
  dayId: string;
  patternId: string;
  onAdd: () => void;
  disabled?: boolean;
};
```

Update the fetch URL:
```typescript
await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots`, { ... });
```

**Step 2: Add patternId prop to EditSpotDialog**

Same pattern - add `patternId` to props and update the PATCH URL:
```typescript
await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/spots/${spot.id}`, { ... });
```

**Step 3: Update SpotItem to pass patternId**

SpotItem receives `patternId` and passes it to EditSpotDialog.

**Step 4: Update DayTimeline to pass patternId to AddSpotDialog and SpotItem**

In `day-timeline.tsx`:
```tsx
<AddSpotDialog tripId={tripId} dayId={dayId} patternId={patternId} onAdd={onRefresh} disabled={disabled} />
```

And for SpotItem:
```tsx
<SpotItem
  key={spot.id}
  {...spot}
  tripId={tripId}
  dayId={dayId}
  patternId={patternId}
  // ... rest of props
/>
```

**Step 5: Verify build**

Run: `bun run check-types`
Expected: PASS (or close to it)

**Step 6: Commit**

```
feat: update spot dialogs for pattern-scoped API paths
```

---

## Task 14: Create AddPatternButton component

**Files:**
- Create: `apps/web/components/add-pattern-button.tsx`

**Step 1: Create the component**

A simple button + dialog that prompts for a label and calls `POST /api/trips/:tripId/days/:dayId/patterns`.

```typescript
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

type AddPatternButtonProps = {
  tripId: string;
  dayId: string;
  onAdd: () => void;
};

export function AddPatternButton({ tripId, dayId, onAdd }: AddPatternButtonProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns`, {
        method: "POST",
        body: JSON.stringify({ label: label.trim() }),
      });
      toast.success("pattern added");
      setOpen(false);
      setLabel("");
      onAdd();
    } catch {
      toast.error("pattern creation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="shrink-0 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="inline h-3 w-3" /> add
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>add pattern</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pattern-label">label</Label>
            <Input
              id="pattern-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. rainy day"
              maxLength={50}
            />
          </div>
          <Button type="submit" disabled={submitting || !label.trim()} className="w-full">
            add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify build**

Run: `bun run check-types`
Expected: PASS

**Step 3: Commit**

```
feat: add AddPatternButton component
```

---

## Task 15: Add pattern context menu (rename, duplicate, delete)

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

**Step 1: Add context menu to pattern tabs**

Use a DropdownMenu from shadcn/ui on each pattern tab (except the + button):

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button type="button" role="tab" ...>
      {pattern.label}
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => handleDuplicateVariant(pattern.id)}>
      duplicate
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => openRenameDialog(pattern)}>
      rename
    </DropdownMenuItem>
    {!pattern.isDefault && (
      <DropdownMenuItem
        className="text-destructive"
        onClick={() => handleDeleteVariant(pattern.id)}
      >
        delete
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

Add handler functions:
- `handleDuplicateVariant`: POST to `/:patternId/duplicate`, then `fetchTrip()`
- `handleDeleteVariant`: DELETE to `/:patternId`, then `fetchTrip()` and reset selected pattern index
- `openRenameDialog`: Opens inline edit or dialog for PATCH with new label

**Step 2: Verify build**

Run: `bun run check-types`
Expected: PASS

**Step 3: Commit**

```
feat: add pattern context menu (rename, duplicate, delete)
```

---

## Task 16: Update shared view for patterns

**Files:**
- Modify: `apps/web/app/shared/[token]/page.tsx`

**Step 1: Update the shared view**

The shared view currently iterates `day.spots`. Update to iterate `day.patterns`:

For each day:
- If only 1 pattern: render spots directly (no pattern label)
- If 2+ patterns: show pattern tabs or sections

Use a simple tab approach similar to the main view but read-only:

```tsx
{day.patterns.length === 1 ? (
  // Render spots directly from day.patterns[0].spots
  <div className="space-y-2">
    {day.patterns[0].spots.map((spot) => (
      // ... existing spot rendering
    ))}
  </div>
) : (
  // Show pattern tabs
  <SharedPatternTabs patterns={day.patterns} />
)}
```

The `SharedPatternTabs` can be a simple client component with local tab state.

**Step 2: Verify build**

Run: `bun run check-types`
Expected: PASS

**Step 3: Commit**

```
feat: update shared view for day patterns
```

---

## Task 17: Full verification

**Step 1: Run type check**

Run: `bun run check-types`
Expected: PASS

**Step 2: Run lint + format**

Run: `bun run check`
Expected: PASS

**Step 3: Run all tests**

Run: `bun run test`
Expected: PASS

**Step 4: Run integration tests**

Run: `bun run --filter @tabi/api test:integration`
Expected: PASS

**Step 5: Manual verification**

Run: `bun run dev`

1. Create a new trip - verify default pattern is created
2. View trip detail - verify spots work as before (single pattern, no pattern tabs)
3. Add a second pattern via "+ add" button
4. Verify pattern tabs appear
5. Add spots to the new pattern
6. Switch between patterns
7. Duplicate a pattern - verify spots are copied
8. Rename a pattern
9. Delete a non-default pattern
10. Check shared view shows patterns

**Step 6: Final commit if needed**

```
chore: fix lint/type issues from day patterns implementation
```
