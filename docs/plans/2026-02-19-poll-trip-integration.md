# Poll-Trip Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate schedule polls into the trip lifecycle. Trips can be created with a "scheduling" status that uses a poll to decide dates, then auto-transition to "draft" on confirmation. Remove standalone polls tab from home page.

**Architecture:** Add "scheduling" to trip status enum. Extend trip creation API to accept poll options. Poll confirmation updates the existing trip (dates + trip_days) instead of creating a new one. Trip detail page gets a "日程調整" tab in the left panel. Home page removes the polls tab.

**Tech Stack:** Drizzle ORM (PostgreSQL), Hono, Zod, React 19, Next.js 15, TanStack Query, shadcn/ui, Tailwind CSS v4

---

## Task 1: Add "scheduling" to Trip Status Enum

**Files:**
- Modify: `packages/shared/src/schemas/trip.ts:6`
- Modify: `apps/api/src/db/schema.ts:19`

**Step 1: Update shared schema**

In `packages/shared/src/schemas/trip.ts`, change line 6:

```typescript
// Before
export const tripStatusSchema = z.enum(["draft", "planned", "active", "completed"]);

// After
export const tripStatusSchema = z.enum(["scheduling", "draft", "planned", "active", "completed"]);
```

**Step 2: Update DB enum**

In `apps/api/src/db/schema.ts`, change line 19:

```typescript
// Before
export const tripStatusEnum = pgEnum("trip_status", ["draft", "planned", "active", "completed"]);

// After
export const tripStatusEnum = pgEnum("trip_status", ["scheduling", "draft", "planned", "active", "completed"]);
```

**Step 3: Push schema**

Run: `bun run db:push`
Expected: Enum updated (Drizzle handles ALTER TYPE for pgEnum)

**Step 4: Verify types compile**

Run: `bun run check-types`
Expected: PASS (or failures from downstream code expecting only 4 statuses - note these for later tasks)

**Step 5: Commit**

```
feat: trip_statusに"scheduling"を追加
```

---

## Task 2: Add createTripWithPollSchema and Response Types

**Files:**
- Modify: `packages/shared/src/schemas/trip.ts`
- Modify: `packages/shared/src/types.ts`

**Step 1: Add createTripWithPollSchema**

In `packages/shared/src/schemas/trip.ts`, add after `createTripSchema` (line 19):

```typescript
import {
  MAX_OPTIONS_PER_POLL,
  POLL_NOTE_MAX_LENGTH,
} from "../limits";
import { pollCandidateSchema } from "./poll";

// Used when creating a trip with schedule poll mode
export const createTripWithPollSchema = z.object({
  title: z.string().min(1).max(TRIP_TITLE_MAX_LENGTH),
  destination: z.string().min(1).max(TRIP_DESTINATION_MAX_LENGTH),
  pollOptions: z
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
    .min(1)
    .max(MAX_OPTIONS_PER_POLL),
  pollNote: z.string().max(POLL_NOTE_MAX_LENGTH).optional(),
});
```

Note: We need to check if `pollCandidateSchema` exists in `poll.ts`. If not, define the option schema inline as shown above.

**Step 2: Add TripPollSummary type**

In `packages/shared/src/types.ts`, add:

```typescript
export type TripPollSummary = {
  id: string;
  status: PollStatus;
  participantCount: number;
  respondedCount: number;
};
```

And update `TripResponse` to include optional poll data:

```typescript
export type TripResponse = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  role: MemberRole;
  days: DayResponse[];
  candidates: CandidateResponse[];
  scheduleCount: number;
  memberCount: number;
  poll: TripPollSummary | null; // NEW
};
```

**Step 3: Verify types compile**

Run: `bun run check-types`
Expected: May have downstream errors from TripResponse change - note for later

**Step 4: Commit**

```
feat: 旅行作成の日程調整モード用スキーマと型を追加
```

---

## Task 3: Extend Trip Creation API for Poll Mode (TDD)

**Files:**
- Modify: `apps/api/src/__tests__/integration/polls.integration.test.ts`
- Modify: `apps/api/src/routes/trips.ts`

**Step 1: Write failing test for trip creation with poll**

Add to `polls.integration.test.ts` (in a new describe block):

```typescript
describe("Trip creation with poll", () => {
  // Re-use the existing test app, but we need trip routes too
  // Adjust createApp() to include tripRoutes

  it("creates a trip with scheduling status and linked poll when pollOptions provided", async () => {
    const res = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Summer Trip",
        destination: "Okinawa",
        pollOptions: [
          { startDate: "2026-08-01", endDate: "2026-08-03" },
          { startDate: "2026-08-08", endDate: "2026-08-10" },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const trip = await res.json();
    expect(trip.status).toBe("scheduling");
    // Uses first option's dates as initial trip dates
    expect(trip.startDate).toBe("2026-08-01");
    expect(trip.endDate).toBe("2026-08-03");
  });

  it("does not create trip_days when status is scheduling", async () => {
    const res = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "No Days Trip",
        destination: "Tokyo",
        pollOptions: [
          { startDate: "2026-09-01", endDate: "2026-09-02" },
        ],
      }),
    });

    const trip = await res.json();

    // Fetch trip detail - should have no days
    const detailRes = await app.request(`/api/trips/${trip.id}`);
    const detail = await detailRes.json();
    expect(detail.days).toHaveLength(0);
  });

  it("creates poll linked to the trip with owner as participant", async () => {
    const res = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Poll Trip",
        destination: "Kyoto",
        pollOptions: [
          { startDate: "2026-10-01", endDate: "2026-10-03" },
          { startDate: "2026-10-15", endDate: "2026-10-17" },
        ],
        pollNote: "Let's decide dates!",
      }),
    });

    const trip = await res.json();

    // Verify poll exists and is linked
    const { getTestDb } = await import("./setup");
    const db = getTestDb();
    const { schedulePolls } = await import("../../db/schema");
    const { eq } = await import("drizzle-orm");

    const poll = await db.query.schedulePolls.findFirst({
      where: eq(schedulePolls.tripId, trip.id),
      with: { options: true, participants: true },
    });

    expect(poll).toBeTruthy();
    expect(poll!.status).toBe("open");
    expect(poll!.title).toBe("Poll Trip");
    expect(poll!.note).toBe("Let's decide dates!");
    expect(poll!.options).toHaveLength(2);
    expect(poll!.participants).toHaveLength(1);
    expect(poll!.participants[0].userId).toBe(owner.id);
  });

  it("still creates a normal trip when startDate/endDate provided (no pollOptions)", async () => {
    const res = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Direct Trip",
        destination: "Nara",
        startDate: "2026-07-01",
        endDate: "2026-07-03",
      }),
    });

    expect(res.status).toBe(201);
    const trip = await res.json();
    expect(trip.status).toBe("draft");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: FAIL

**Step 3: Implement poll-mode trip creation in trips.ts**

In `apps/api/src/routes/trips.ts`, modify the POST handler (around line 49):

```typescript
import { createTripSchema, createTripWithPollSchema } from "@sugara/shared";
import {
  schedulePolls,
  schedulePollOptions,
  schedulePollParticipants,
} from "../db/schema";

tripRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  // Determine mode: poll mode if pollOptions is present
  const isPollMode = Array.isArray(body.pollOptions);

  if (isPollMode) {
    const parsed = createTripWithPollSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const { title, destination, pollOptions, pollNote } = parsed.data;
    // Use first option's dates as initial trip dates
    const startDate = pollOptions[0].startDate;
    const endDate = pollOptions[0].endDate;

    const result = await db.transaction(async (tx) => {
      const [tripCount] = await tx
        .select({ count: count() })
        .from(trips)
        .where(eq(trips.ownerId, user.id));
      if (tripCount.count >= MAX_TRIPS_PER_USER) return null;

      // Create trip with "scheduling" status, NO trip_days
      const [trip] = await tx
        .insert(trips)
        .values({
          ownerId: user.id,
          title,
          destination,
          startDate,
          endDate,
          status: "scheduling",
        })
        .returning();

      // Add owner as trip member
      await tx.insert(tripMembers).values({
        tripId: trip.id,
        userId: user.id,
        role: "owner",
      });

      // Create linked poll
      const [poll] = await tx
        .insert(schedulePolls)
        .values({
          ownerId: user.id,
          title,
          destination,
          note: pollNote ?? null,
          tripId: trip.id,
        })
        .returning();

      // Create poll options
      await tx.insert(schedulePollOptions).values(
        pollOptions.map((opt, i) => ({
          pollId: poll.id,
          startDate: opt.startDate,
          endDate: opt.endDate,
          sortOrder: i,
        })),
      );

      // Auto-add owner as poll participant
      await tx.insert(schedulePollParticipants).values({
        pollId: poll.id,
        userId: user.id,
      });

      return trip;
    });

    if (!result) {
      return c.json({ error: ERROR_MSG.LIMIT_TRIPS }, 409);
    }

    await logActivity(db, result.id, user.id, "created", "trip", title);
    return c.json(result, 201);
  }

  // Existing direct-date flow (unchanged)
  const parsed = createTripSchema.safeParse(body);
  // ... rest of existing code
});
```

**Step 4: Run tests**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: PASS

**Step 5: Run full test suite**

Run: `bun run test`
Expected: PASS (existing trip tests should still pass since they use startDate/endDate)

**Step 6: Commit**

```
feat: 旅行作成APIに日程調整モードを追加
```

---

## Task 4: Modify Poll Confirm to Update Existing Trip (TDD)

**Files:**
- Modify: `apps/api/src/__tests__/integration/polls.integration.test.ts`
- Modify: `apps/api/src/routes/polls.ts`

**Step 1: Write failing test**

```typescript
describe("Poll confirm with existing trip", () => {
  it("updates existing trip dates and status on confirm", async () => {
    // Create trip with poll
    const createRes = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Confirm Trip",
        destination: "Osaka",
        pollOptions: [
          { startDate: "2026-08-01", endDate: "2026-08-03" },
          { startDate: "2026-09-10", endDate: "2026-09-12" },
        ],
      }),
    });
    const trip = await createRes.json();
    expect(trip.status).toBe("scheduling");

    // Get poll linked to trip
    const { getTestDb } = await import("./setup");
    const db = getTestDb();
    const { schedulePolls } = await import("../../db/schema");
    const { eq } = await import("drizzle-orm");

    const poll = await db.query.schedulePolls.findFirst({
      where: eq(schedulePolls.tripId, trip.id),
      with: { options: true },
    });

    // Confirm with second option
    const confirmRes = await app.request(`/api/polls/${poll!.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: poll!.options[1].id }),
    });
    expect(confirmRes.status).toBe(200);

    // Verify trip was updated (not a new trip created)
    const { trips, tripDays } = await import("../../db/schema");
    const updatedTrip = await db.query.trips.findFirst({
      where: eq(trips.id, trip.id),
    });

    expect(updatedTrip!.status).toBe("draft");
    expect(updatedTrip!.startDate).toBe("2026-09-10");
    expect(updatedTrip!.endDate).toBe("2026-09-12");

    // Verify trip_days were created
    const days = await db.query.tripDays.findMany({
      where: eq(tripDays.tripId, trip.id),
    });
    expect(days).toHaveLength(3); // 3 days: 9/10, 9/11, 9/12
  });

  it("adds poll participants as trip members on confirm", async () => {
    const other = await createTestUser({ name: "Participant", email: "part@test.com" });

    const createRes = await app.request("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Member Trip",
        destination: "Tokyo",
        pollOptions: [
          { startDate: "2026-11-01", endDate: "2026-11-02" },
        ],
      }),
    });
    const trip = await createRes.json();

    const { getTestDb } = await import("./setup");
    const db = getTestDb();
    const { schedulePolls } = await import("../../db/schema");
    const { eq } = await import("drizzle-orm");

    const poll = await db.query.schedulePolls.findFirst({
      where: eq(schedulePolls.tripId, trip.id),
      with: { options: true },
    });

    // Add participant to poll
    await app.request(`/api/polls/${poll!.id}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: other.id }),
    });

    // Confirm
    await app.request(`/api/polls/${poll!.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: poll!.options[0].id }),
    });

    // Verify members
    const { tripMembers } = await import("../../db/schema");
    const members = await db.query.tripMembers.findMany({
      where: eq(tripMembers.tripId, trip.id),
    });
    expect(members).toHaveLength(2); // owner + participant
    expect(members.find((m) => m.userId === other.id)?.role).toBe("editor");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: FAIL (confirm still creates a new trip)

**Step 3: Modify confirm endpoint in polls.ts**

Replace the confirm handler (around line 534-604) with logic that checks for an existing trip:

```typescript
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
    let tripId = poll.tripId;

    if (tripId) {
      // Trip already exists (created with poll mode) - update it
      await tx
        .update(trips)
        .set({
          startDate: option.startDate,
          endDate: option.endDate,
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(trips.id, tripId));

      // Create trip_days (didn't exist for scheduling trips)
      await createInitialTripDays(tx, tripId, option.startDate, option.endDate);

      // Add poll participants who aren't already trip members
      const participants = await tx.query.schedulePollParticipants.findMany({
        where: eq(schedulePollParticipants.pollId, pollId),
      });
      const existingMembers = await tx.query.tripMembers.findMany({
        where: eq(tripMembers.tripId, tripId),
      });
      const existingUserIds = new Set(existingMembers.map((m) => m.userId));

      const newMembers = participants.filter(
        (p) => p.userId !== null && !existingUserIds.has(p.userId!),
      );
      if (newMembers.length > 0) {
        await tx.insert(tripMembers).values(
          newMembers.map((p) => ({
            tripId: tripId!,
            userId: p.userId!,
            role: "editor" as const,
          })),
        );
      }
    } else {
      // Legacy: poll created without a trip (standalone poll) - create trip
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

      tripId = trip.id;
      await createInitialTripDays(tx, trip.id, option.startDate, option.endDate);

      const participants = await tx.query.schedulePollParticipants.findMany({
        where: eq(schedulePollParticipants.pollId, pollId),
      });
      const registeredParticipants = participants.filter((p) => p.userId !== null);
      if (registeredParticipants.length > 0) {
        await tx.insert(tripMembers).values(
          registeredParticipants.map((p) => ({
            tripId: trip.id,
            userId: p.userId!,
            role: p.userId === user.id ? ("owner" as const) : ("editor" as const),
          })),
        );
      }
    }

    // Update poll status
    const [updatedPoll] = await tx
      .update(schedulePolls)
      .set({
        status: "confirmed",
        confirmedOptionId: option.id,
        tripId: tripId,
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

**Step 4: Run tests**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: PASS

**Step 5: Run full test suite**

Run: `bun run test`
Expected: PASS

**Step 6: Commit**

```
feat: 日程調整確定時に既存旅行を更新するように変更
```

---

## Task 5: Add Poll Data to Trip Detail API Response

**Files:**
- Modify: `apps/api/src/routes/trips.ts` (GET /:id handler)

**Step 1: Write failing test**

Add to `polls.integration.test.ts`:

```typescript
it("trip detail includes poll summary when trip has a linked poll", async () => {
  const createRes = await app.request("/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Poll Detail Trip",
      destination: "Hokkaido",
      pollOptions: [
        { startDate: "2026-12-01", endDate: "2026-12-03" },
      ],
    }),
  });
  const trip = await createRes.json();

  const detailRes = await app.request(`/api/trips/${trip.id}`);
  const detail = await detailRes.json();

  expect(detail.poll).toBeTruthy();
  expect(detail.poll.status).toBe("open");
  expect(detail.poll.participantCount).toBe(1);
  expect(detail.poll.respondedCount).toBe(0);
});

it("trip detail has poll: null when no linked poll", async () => {
  const createRes = await app.request("/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "No Poll Trip",
      destination: "Nagoya",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
    }),
  });
  const trip = await createRes.json();

  const detailRes = await app.request(`/api/trips/${trip.id}`);
  const detail = await detailRes.json();

  expect(detail.poll).toBeNull();
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: FAIL

**Step 3: Modify GET /:id in trips.ts**

After fetching the trip, query for a linked poll:

```typescript
// After existing trip fetch (around line 131)
const linkedPoll = await db.query.schedulePolls.findFirst({
  where: eq(schedulePolls.tripId, trip.id),
  columns: { id: true, status: true },
});

let pollSummary: { id: string; status: string; participantCount: number; respondedCount: number } | null = null;

if (linkedPoll) {
  const [participantCount] = await db
    .select({ count: count() })
    .from(schedulePollParticipants)
    .where(eq(schedulePollParticipants.pollId, linkedPoll.id));

  const [respondedCount] = await db
    .select({ count: count(sql`DISTINCT ${schedulePollResponses.participantId}`) })
    .from(schedulePollResponses)
    .innerJoin(
      schedulePollParticipants,
      eq(schedulePollResponses.participantId, schedulePollParticipants.id),
    )
    .where(eq(schedulePollParticipants.pollId, linkedPoll.id));

  pollSummary = {
    id: linkedPoll.id,
    status: linkedPoll.status,
    participantCount: participantCount.count,
    respondedCount: respondedCount.count,
  };
}

// Add to response:
return c.json({
  // ...existing fields
  poll: pollSummary,
});
```

**Step 4: Run tests**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: PASS

**Step 5: Commit**

```
feat: 旅行詳細APIに日程調整サマリーを追加
```

---

## Task 6: Handle "scheduling" Status in Trip Detail Page

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

**Step 1: Skip trip_days fetch/display when status is "scheduling"**

In the trip detail page, the left panel currently always renders DayTabs + DayTimeline. When `trip.status === "scheduling"`:

- Don't render DayTabs (there are no trip_days)
- Show a message/banner: "日程調整中 - 日程が確定するとスケジュールを作成できます"
- Disable drag-and-drop and schedule editing
- Show a link/button to go to the poll tab (Task 8)

```tsx
// In the left panel section (around line 404)
{trip.status === "scheduling" ? (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <p className="text-lg font-medium">日程調整中</p>
    <p className="mt-1 text-sm text-muted-foreground">
      日程が確定するとスケジュールを作成できます
    </p>
    {trip.poll && (
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => router.push(`/polls/${trip.poll.id}`)}
      >
        日程調整を開く
      </Button>
    )}
  </div>
) : (
  // Existing DayTabs + DayTimeline rendering
)}
```

**Step 2: Handle "scheduling" in status display**

Find where trip status is shown (likely in EditTripDialog or a status badge) and add the "scheduling" label. Check `apps/web/components/edit-trip-dialog.tsx` and any status badge component.

The status select dropdown should not allow manual transition to/from "scheduling" - it's system-managed.

**Step 3: Verify the page renders correctly for both modes**

Run: `bun run --filter @sugara/web dev`
- Create a trip with direct dates -> should show day tabs as before
- (For scheduling trips, we need the frontend dialog changes from Task 7 first)

**Step 4: Commit**

```
feat: 旅行詳細ページで日程調整中ステータスを処理
```

---

## Task 7: Modify CreateTripDialog with Mode Toggle

**Files:**
- Modify: `apps/web/components/create-trip-dialog.tsx`

**Step 1: Add mode toggle**

Redesign the dialog to support two modes:

```tsx
type DateMode = "direct" | "poll";

export function CreateTripDialog({ open, onOpenChange, onCreated }: CreateTripDialogProps) {
  const [dateMode, setDateMode] = useState<DateMode>("direct");
  // ... existing state for direct mode
  // ... new state for poll mode (from CreatePollDialog)
  const [candidates, setCandidates] = useState<{ startDate: string; endDate: string }[]>([]);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>();
  const [pollNote, setPollNote] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // resetAll should clear both modes' state

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const destination = formData.get("destination") as string;

    if (dateMode === "poll") {
      if (candidates.length === 0) {
        setError(MSG.POLL_CANDIDATE_REQUIRED);
        setLoading(false);
        return;
      }

      const body: Record<string, unknown> = {
        title,
        destination,
        pollOptions: candidates,
      };
      if (pollNote) body.pollNote = pollNote;

      try {
        const trip = await api<{ id: string }>("/api/trips", {
          method: "POST",
          body: JSON.stringify(body),
        });
        onOpenChange(false);
        toast.success(MSG.TRIP_CREATED);
        onCreated();
        router.push(`/trips/${trip.id}`);
      } catch (err) {
        setError(getApiErrorMessage(err, MSG.TRIP_CREATE_FAILED));
      } finally {
        setLoading(false);
      }
    } else {
      // Existing direct mode logic
      const data = {
        title,
        destination,
        startDate: formData.get("startDate") as string,
        endDate: formData.get("endDate") as string,
      };
      // ... rest of existing submit logic
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新しい旅行を作成</DialogTitle>
          <DialogDescription>旅行の基本情報を入力してください</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title and Destination (same for both modes) */}
          <div className="space-y-2">
            <Label htmlFor="create-title">
              旅行タイトル <span className="text-destructive">*</span>
            </Label>
            <Input id="create-title" name="title" placeholder="京都3日間の旅" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-destination">
              目的地 <span className="text-destructive">*</span>
            </Label>
            <Input id="create-destination" name="destination" placeholder="京都" required />
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 rounded-lg border p-1">
            <button
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                dateMode === "direct"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setDateMode("direct")}
            >
              日程を決定する
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                dateMode === "poll"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setDateMode("poll")}
            >
              日程を調整する
            </button>
          </div>

          {dateMode === "direct" ? (
            /* Existing DateRangePicker */
            <div className="space-y-2">
              <Label>旅行期間 <span className="text-destructive">*</span></Label>
              <DateRangePicker ... />
              <input type="hidden" name="startDate" value={startDate} />
              <input type="hidden" name="endDate" value={endDate} />
            </div>
          ) : (
            /* Poll mode: Calendar + candidates list (from CreatePollDialog) */
            <>
              <div className="space-y-2">
                <Label>候補日 <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground">
                  カレンダーで日付範囲を選択し「候補に追加」で追加
                </p>
                <div className="flex flex-col items-center">
                  <CalendarNav ... />
                  <Calendar mode="range" ... />
                </div>
                <div className="flex justify-center">
                  <Button type="button" variant="outline" size="sm"
                    onClick={handleAddCandidate} disabled={!pendingRange?.from}>
                    <Plus className="h-4 w-4" />
                    候補に追加
                  </Button>
                </div>
                {/* Candidates list */}
                {candidates.length > 0 && (
                  <div className="space-y-1">...</div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="poll-note">メモ</Label>
                <Textarea id="poll-note" value={pollNote}
                  onChange={(e) => setPollNote(e.target.value)}
                  placeholder="参加者への連絡事項など" rows={2} />
              </div>
            </>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              <Plus className="h-4 w-4" />
              {loading ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify it works**

Run dev server, test both modes

**Step 3: Commit**

```
feat: 旅行作成ダイアログに日程調整モードを追加
```

---

## Task 8: Remove Polls Tab from Home Page

**Files:**
- Modify: `apps/web/app/(authenticated)/home/page.tsx`

**Step 1: Remove polls tab and related code**

1. Remove `"polls"` from the `HomeTab` type
2. Remove `createPollOpen` state and `CreatePollDialog` component
3. Remove polls query (`useQuery` for polls)
4. Remove poll-related filtering (`filteredPolls`)
5. Remove poll-related bulk delete (`handleDeleteSelectedPolls`)
6. Remove `PollCard` import and polls tab rendering
7. Remove `newPollButton`
8. Remove the `"polls"` entry from the `tabs` array
9. Remove `CreatePollDialog` JSX at the bottom

**Step 2: Verify home page works**

Run dev server, check that home has only "自分の旅行" and "共有された旅行" tabs.

**Step 3: Commit**

```
refactor: ホーム画面から日程調整タブを削除
```

---

## Task 9: Add Poll Tab to Trip Detail Page (Left Panel)

This is the most complex frontend task. The poll management UI from the standalone poll detail page needs to be embedded as a tab in the trip detail page's left panel.

**Files:**
- Create: `apps/web/app/(authenticated)/trips/[id]/_components/poll-tab.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

**Step 1: Extract PollTab component**

Create a new component that encapsulates the poll management UI. This borrows heavily from the existing poll detail page (`/polls/[pollId]/page.tsx`) but is designed to live within the trip detail page.

The PollTab component should:
- Fetch full poll detail via `GET /api/polls/:pollId`
- Show the response matrix (candidate dates x participants, with OK/Maybe/NG)
- Allow the owner to add/remove candidates, add/remove participants
- Allow participants to submit responses
- Allow the owner to confirm a date (which updates the trip)
- After confirmation, show the confirmed result (read-only)
- Show share link generation

```tsx
// apps/web/app/(authenticated)/trips/[id]/_components/poll-tab.tsx
type PollTabProps = {
  pollId: string;
  tripId: string;
  isOwner: boolean;
  canEdit: boolean;
};

export function PollTab({ pollId, tripId, isOwner, canEdit }: PollTabProps) {
  const queryClient = useQueryClient();

  const { data: poll } = useQuery({
    queryKey: queryKeys.polls.detail(pollId),
    queryFn: () => api<PollDetailResponse>(`/api/polls/${pollId}`),
  });

  // ... response matrix, participant management, confirm button
  // Reuse/adapt code from existing /polls/[pollId]/page.tsx
}
```

**Step 2: Integrate PollTab into trip detail page**

In the trip detail page, add a tab system above the day tabs:

- When `trip.status === "scheduling"`: Show only PollTab (no day tabs)
- When `trip.poll !== null && trip.status !== "scheduling"`: Show day tabs + "日程調整" tab
- When `trip.poll === null`: Show only day tabs (current behavior)

```tsx
// In trip detail page
type LeftPanelTab = "schedule" | "poll";

const [leftTab, setLeftTab] = useState<LeftPanelTab>(
  trip.status === "scheduling" ? "poll" : "schedule"
);

// Tab buttons
{trip.poll && (
  <div className="flex gap-1 border-b mb-2">
    {trip.status !== "scheduling" && (
      <button onClick={() => setLeftTab("schedule")}
        className={cn("px-3 py-1.5 text-sm", leftTab === "schedule" ? TAB_ACTIVE : TAB_INACTIVE)}>
        スケジュール
      </button>
    )}
    <button onClick={() => setLeftTab("poll")}
      className={cn("px-3 py-1.5 text-sm", leftTab === "poll" ? TAB_ACTIVE : TAB_INACTIVE)}>
      日程調整
    </button>
  </div>
)}

// Content
{leftTab === "poll" && trip.poll ? (
  <PollTab pollId={trip.poll.id} tripId={trip.id} isOwner={...} canEdit={...} />
) : (
  // Existing DayTabs + DayTimeline
)}
```

**Step 3: Handle poll confirmation callback**

When the poll is confirmed inside PollTab, the trip data needs to be refetched:

```tsx
// In PollTab, after successful confirm:
async function handleConfirm(optionId: string) {
  await api(`/api/polls/${pollId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ optionId }),
  });
  toast.success(MSG.POLL_CONFIRMED);
  // Invalidate trip query to refresh with new dates and status
  queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
  // Switch to schedule tab
  onConfirmed?.();
}
```

**Step 4: Verify the full flow**

1. Create trip with poll mode
2. Trip detail shows poll tab only (scheduling status)
3. Add participants, submit responses
4. Confirm a date
5. Trip transitions to draft, day tabs appear
6. Poll tab remains accessible

**Step 5: Commit**

```
feat: 旅行詳細ページに日程調整タブを統合
```

---

## Task 10: Cleanup - Remove Standalone Poll Pages and Unused Components

**Files:**
- Delete: `apps/web/app/(authenticated)/polls/[pollId]/page.tsx`
- Keep: `apps/web/app/polls/shared/[token]/page.tsx` (guest access - unchanged)
- Delete: `apps/web/components/create-poll-dialog.tsx` (replaced by CreateTripDialog)
- Delete: `apps/web/components/poll-card.tsx` (no longer used on home page)
- Delete: `apps/web/components/edit-poll-dialog.tsx` (edit functionality now in PollTab)
- Evaluate: `apps/web/components/poll-participant-dialog.tsx` (may be reused by PollTab or replaced)
- Modify: `apps/web/app/(authenticated)/home/page.tsx` - remove any remaining poll imports

**Step 1: Delete unused files**

Remove files that are no longer imported anywhere.

**Step 2: Clean up imports**

Search for any remaining imports of deleted components and remove them.

**Step 3: Handle /polls/[pollId] redirect**

For authenticated users who might have bookmarked `/polls/[pollId]`, add a redirect:

```tsx
// apps/web/app/(authenticated)/polls/[pollId]/page.tsx
// Replace with redirect logic
"use client";

import { useQuery } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { PollDetailResponse } from "@sugara/shared";

export default function PollRedirectPage({ params }: { params: Promise<{ pollId: string }> }) {
  const { pollId } = use(params);
  const { data: poll } = useQuery({
    queryKey: ["polls", pollId],
    queryFn: () => api<PollDetailResponse>(`/api/polls/${pollId}`),
  });

  if (poll?.tripId) {
    redirect(`/trips/${poll.tripId}`);
  }

  // Fallback for standalone polls (legacy)
  return <div>...</div>;
}
```

**Step 4: Verify no broken imports**

Run: `bun run check-types`
Expected: PASS

**Step 5: Run lint**

Run: `bun run check`
Expected: PASS

**Step 6: Commit**

```
refactor: 不要な日程調整スタンドアロンページとコンポーネントを削除
```

---

## Task 11: Handle "scheduling" in Status Filter and Trip Cards

**Files:**
- Modify: `apps/web/components/trip-toolbar.tsx` (status filter)
- Modify: `apps/web/components/trip-card.tsx` (status badge)
- Modify: `apps/web/components/edit-trip-dialog.tsx` (status select)

**Step 1: Add "scheduling" status badge**

In any component that renders a trip status badge, add the "scheduling" case:

```tsx
// Example mapping
const statusLabels: Record<TripStatus, string> = {
  scheduling: "日程調整中",
  draft: "下書き",
  planned: "計画済み",
  active: "進行中",
  completed: "完了",
};
```

**Step 2: Add "scheduling" to status filter**

In `trip-toolbar.tsx`, add "scheduling" to the StatusFilter type and filter options.

**Step 3: Exclude "scheduling" from manual status selection**

In `edit-trip-dialog.tsx`, the status dropdown should not include "scheduling" as an option. Users can't manually set a trip to scheduling - it's only set during poll-mode creation and cleared on confirm.

**Step 4: Verify**

Run: `bun run check-types && bun run check`

**Step 5: Commit**

```
feat: UIに日程調整中ステータスの表示とフィルタを追加
```

---

## Task 12: Delete Poll Cascades to Trip (scheduling only)

**Files:**
- Modify: `apps/api/src/routes/polls.ts` (DELETE handler)
- Add test to `polls.integration.test.ts`

**Step 1: Write test**

```typescript
it("deleting a poll also deletes the trip when trip is in scheduling status", async () => {
  const createRes = await app.request("/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Delete Cascade",
      destination: "Tokyo",
      pollOptions: [{ startDate: "2026-08-01", endDate: "2026-08-02" }],
    }),
  });
  const trip = await createRes.json();

  const { getTestDb } = await import("./setup");
  const db = getTestDb();
  const { schedulePolls, trips } = await import("../../db/schema");
  const { eq } = await import("drizzle-orm");

  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.tripId, trip.id),
  });

  const deleteRes = await app.request(`/api/polls/${poll!.id}`, { method: "DELETE" });
  expect(deleteRes.status).toBe(200);

  // Trip should also be deleted
  const deletedTrip = await db.query.trips.findFirst({
    where: eq(trips.id, trip.id),
  });
  expect(deletedTrip).toBeUndefined();
});

it("deleting a poll does NOT delete trip when trip is confirmed (draft status)", async () => {
  // Create trip with poll, confirm it, then delete poll
  // Trip should remain
});
```

**Step 2: Modify delete handler**

```typescript
pollRoutes.delete("/:pollId", async (c) => {
  const user = c.get("user");
  const pollId = c.req.param("pollId");

  const poll = await findPollAsOwner(pollId, user.id);
  if (!poll) return c.json({ error: ERROR_MSG.POLL_NOT_FOUND }, 404);

  await db.transaction(async (tx) => {
    // If poll is linked to a trip that's still in scheduling, delete the trip too
    if (poll.tripId) {
      const trip = await tx.query.trips.findFirst({
        where: eq(trips.id, poll.tripId),
        columns: { id: true, status: true },
      });
      if (trip?.status === "scheduling") {
        await tx.delete(trips).where(eq(trips.id, trip.id));
      }
    }
    await tx.delete(schedulePolls).where(eq(schedulePolls.id, pollId));
  });

  return c.json({ ok: true });
});
```

**Step 3: Run tests**

Run: `bun run --filter @sugara/api test -- polls.integration`
Expected: PASS

**Step 4: Commit**

```
feat: 日程調整中の旅行はポール削除時にカスケード削除
```

---

## Task 13: Final Verification

**Step 1: Run type check**

Run: `bun run check-types`
Expected: PASS

**Step 2: Run lint and format**

Run: `bun run check`
Expected: PASS

**Step 3: Run full test suite**

Run: `bun run test`
Expected: PASS

**Step 4: Push schema**

Run: `bun run db:push`
Expected: Schema up to date

**Step 5: Manual E2E verification**

1. Create trip with direct dates -> works as before
2. Create trip with poll mode -> trip in "scheduling" status
3. Trip detail shows poll tab with response matrix
4. Add participants, submit responses via poll tab
5. Generate share link, verify guest access works
6. Confirm a date -> trip transitions to "draft", day tabs appear
7. Poll tab remains visible (read-only)
8. Home page shows no polls tab, trips with "scheduling" status appear in "自分の旅行"
9. Delete poll on a scheduling trip -> trip also deleted
10. Delete poll on a confirmed trip -> trip remains

**Step 6: Final commit if any fixes needed**

```
fix: 日程調整統合の最終調整
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Add "scheduling" to trip status enum | `schemas/trip.ts`, `db/schema.ts` |
| 2 | Add createTripWithPollSchema, TripPollSummary type | `schemas/trip.ts`, `types.ts` |
| 3 | Extend POST /api/trips for poll mode (TDD) | `routes/trips.ts`, tests |
| 4 | Modify poll confirm to update existing trip (TDD) | `routes/polls.ts`, tests |
| 5 | Add poll data to GET /api/trips/:id (TDD) | `routes/trips.ts`, tests |
| 6 | Handle "scheduling" status in trip detail page | `trips/[id]/page.tsx` |
| 7 | Modify CreateTripDialog with mode toggle | `create-trip-dialog.tsx` |
| 8 | Remove polls tab from home page | `home/page.tsx` |
| 9 | Add PollTab to trip detail left panel | `poll-tab.tsx`, `trips/[id]/page.tsx` |
| 10 | Cleanup standalone poll pages/components | Delete unused files |
| 11 | Handle "scheduling" in status filter/badges | `trip-toolbar.tsx`, `trip-card.tsx` |
| 12 | Delete poll cascades to scheduling trip (TDD) | `routes/polls.ts`, tests |
| 13 | Final verification | Type check, lint, tests, E2E |

## Architecture Flow

```
旅行作成ダイアログ
  ├─ "日程を決定する" → POST /api/trips { startDate, endDate }
  │   └─ Trip (status: "draft") + trip_days
  │
  └─ "日程を調整する" → POST /api/trips { pollOptions }
      └─ Trip (status: "scheduling", no trip_days) + Poll (status: "open")
          │
          ├─ 参加者追加 / 回答送信 / 共有リンク
          │
          └─ 日程確定 → POST /api/polls/:id/confirm
              └─ Trip: status → "draft", dates updated, trip_days created
                 Poll: status → "confirmed"
```
