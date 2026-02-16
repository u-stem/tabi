import {
  assignCandidateSchema,
  batchAssignCandidatesSchema,
  batchDeleteSchedulesSchema,
  createCandidateSchema,
  MAX_SCHEDULES_PER_TRIP,
  reorderSchedulesSchema,
  updateScheduleSchema,
} from "@sugara/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { dayPatterns, schedules } from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { queryCandidatesWithReactions } from "../lib/candidate-query";
import { ERROR_MSG } from "../lib/constants";
import { buildScheduleCloneValues } from "../lib/schedule-clone";
import { getScheduleCount } from "../lib/schedule-count";
import { getNextSortOrder } from "../lib/sort-order";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const candidateRoutes = new Hono<AppEnv>();
candidateRoutes.use("*", requireAuth);

// List candidates for a trip
candidateRoutes.get("/:tripId/candidates", requireTripAccess(), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const candidates = await queryCandidatesWithReactions(tripId, user.id);
  return c.json(candidates);
});

// Create candidate
candidateRoutes.post("/:tripId/candidates", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const body = await c.req.json();
  const parsed = createCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const scheduleCount = await getScheduleCount(db, tripId);
  if (scheduleCount >= MAX_SCHEDULES_PER_TRIP) {
    return c.json({ error: ERROR_MSG.LIMIT_SCHEDULES }, 409);
  }

  const nextOrder = await getNextSortOrder(
    db,
    schedules.sortOrder,
    schedules,
    and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)),
  );

  const [schedule] = await db
    .insert(schedules)
    .values({
      tripId,
      ...parsed.data,
      sortOrder: nextOrder,
    })
    .returning();

  logActivity({
    tripId,
    userId: user.id,
    action: "created",
    entityType: "candidate",
    entityName: schedule.name,
  });

  return c.json(schedule, 201);
});

// Batch assign candidates to a day pattern
candidateRoutes.post("/:tripId/candidates/batch-assign", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const body = await c.req.json();
  const parsed = batchAssignCandidatesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [candidates, pattern] = await Promise.all([
    db.query.schedules.findMany({
      where: and(
        inArray(schedules.id, parsed.data.scheduleIds),
        eq(schedules.tripId, tripId),
        isNull(schedules.dayPatternId),
      ),
    }),
    db.query.dayPatterns.findFirst({
      where: eq(dayPatterns.id, parsed.data.dayPatternId),
      with: { tripDay: true },
    }),
  ]);
  if (candidates.length !== parsed.data.scheduleIds.length) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }
  if (!pattern || pattern.tripDay.tripId !== tripId) {
    return c.json({ error: ERROR_MSG.PATTERN_NOT_FOUND }, 404);
  }

  await db.transaction(async (tx) => {
    let nextOrder = await getNextSortOrder(
      tx,
      schedules.sortOrder,
      schedules,
      eq(schedules.dayPatternId, parsed.data.dayPatternId),
    );

    for (const scheduleId of parsed.data.scheduleIds) {
      await tx
        .update(schedules)
        .set({
          dayPatternId: parsed.data.dayPatternId,
          sortOrder: nextOrder++,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, scheduleId));
    }
  });

  logActivity({
    tripId,
    userId: user.id,
    action: "assigned",
    entityType: "candidate",
    detail: `${parsed.data.scheduleIds.length}件`,
  });

  return c.json({ ok: true });
});

// Batch delete candidates
candidateRoutes.post("/:tripId/candidates/batch-delete", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const body = await c.req.json();
  const parsed = batchDeleteSchedulesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const candidates = await db.query.schedules.findMany({
    where: and(
      inArray(schedules.id, parsed.data.scheduleIds),
      eq(schedules.tripId, tripId),
      isNull(schedules.dayPatternId),
    ),
  });
  if (candidates.length !== parsed.data.scheduleIds.length) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  await db.delete(schedules).where(inArray(schedules.id, parsed.data.scheduleIds));

  logActivity({
    tripId,
    userId: user.id,
    action: "deleted",
    entityType: "candidate",
    detail: `${parsed.data.scheduleIds.length}件`,
  });

  return c.json({ ok: true });
});

// Batch duplicate candidates
candidateRoutes.post(
  "/:tripId/candidates/batch-duplicate",
  requireTripAccess("editor"),
  async (c) => {
    const user = c.get("user");
    const tripId = c.req.param("tripId");

    const body = await c.req.json();
    const parsed = batchDeleteSchedulesSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const scheduleCount = await getScheduleCount(db, tripId);
    if (scheduleCount + parsed.data.scheduleIds.length > MAX_SCHEDULES_PER_TRIP) {
      return c.json({ error: ERROR_MSG.LIMIT_SCHEDULES }, 409);
    }

    const candidates = await db.query.schedules.findMany({
      where: and(
        inArray(schedules.id, parsed.data.scheduleIds),
        eq(schedules.tripId, tripId),
        isNull(schedules.dayPatternId),
      ),
    });
    if (candidates.length !== parsed.data.scheduleIds.length) {
      return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
    }

    let nextOrder = await getNextSortOrder(
      db,
      schedules.sortOrder,
      schedules,
      and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)),
    );

    // Preserve the order of scheduleIds in the request
    const scheduleById = new Map(candidates.map((s) => [s.id, s]));
    const ordered = parsed.data.scheduleIds.reduce<typeof candidates>((acc, id) => {
      const schedule = scheduleById.get(id);
      if (schedule) acc.push(schedule);
      return acc;
    }, []);

    const duplicated = await db
      .insert(schedules)
      .values(
        ordered.map((schedule) => ({
          tripId,
          ...buildScheduleCloneValues(schedule, { sortOrder: nextOrder++ }),
        })),
      )
      .returning();

    logActivity({
      tripId,
      userId: user.id,
      action: "duplicated",
      entityType: "candidate",
      detail: `${duplicated.length}件`,
    });

    return c.json(duplicated, 201);
  },
);

// Reorder candidates (registered before /:scheduleId to avoid route conflict)
candidateRoutes.patch("/:tripId/candidates/reorder", requireTripAccess("editor"), async (c) => {
  const tripId = c.req.param("tripId");

  const body = await c.req.json();
  const parsed = reorderSchedulesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  if (parsed.data.scheduleIds.length > 0) {
    const targets = await db.query.schedules.findMany({
      where: and(
        inArray(schedules.id, parsed.data.scheduleIds),
        eq(schedules.tripId, tripId),
        isNull(schedules.dayPatternId),
      ),
    });
    if (targets.length !== parsed.data.scheduleIds.length) {
      return c.json({ error: ERROR_MSG.INVALID_CANDIDATE_REORDER }, 400);
    }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.scheduleIds.length; i++) {
      await tx
        .update(schedules)
        .set({ sortOrder: i })
        .where(eq(schedules.id, parsed.data.scheduleIds[i]));
    }
  });

  return c.json({ ok: true });
});

// Update candidate
candidateRoutes.patch("/:tripId/candidates/:scheduleId", requireTripAccess("editor"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const scheduleId = c.req.param("scheduleId");

  const body = await c.req.json();
  const parsed = updateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.schedules.findFirst({
    where: and(
      eq(schedules.id, scheduleId),
      eq(schedules.tripId, tripId),
      isNull(schedules.dayPatternId),
    ),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
  }

  const { expectedUpdatedAt, ...updateData } = parsed.data;

  // Atomic optimistic lock: include updatedAt in WHERE clause
  const whereConditions = expectedUpdatedAt
    ? and(
        eq(schedules.id, scheduleId),
        sql`date_trunc('milliseconds', ${schedules.updatedAt}) = ${expectedUpdatedAt}::timestamptz`,
      )
    : eq(schedules.id, scheduleId);

  const [updated] = await db
    .update(schedules)
    .set({ ...updateData, updatedAt: new Date() })
    .where(whereConditions)
    .returning();

  if (!updated) {
    return c.json({ error: ERROR_MSG.CONFLICT }, 409);
  }

  logActivity({
    tripId,
    userId: user.id,
    action: "updated",
    entityType: "candidate",
    entityName: updated.name,
  });

  return c.json(updated);
});

// Delete candidate
candidateRoutes.delete(
  "/:tripId/candidates/:scheduleId",
  requireTripAccess("editor"),
  async (c) => {
    const user = c.get("user");
    const tripId = c.req.param("tripId");
    const scheduleId = c.req.param("scheduleId");

    const existing = await db.query.schedules.findFirst({
      where: and(
        eq(schedules.id, scheduleId),
        eq(schedules.tripId, tripId),
        isNull(schedules.dayPatternId),
      ),
    });
    if (!existing) {
      return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
    }

    await db.delete(schedules).where(eq(schedules.id, scheduleId));

    logActivity({
      tripId,
      userId: user.id,
      action: "deleted",
      entityType: "candidate",
      entityName: existing.name,
    });

    return c.json({ ok: true });
  },
);

// Assign candidate to a day pattern
candidateRoutes.post(
  "/:tripId/candidates/:scheduleId/assign",
  requireTripAccess("editor"),
  async (c) => {
    const user = c.get("user");
    const tripId = c.req.param("tripId");
    const scheduleId = c.req.param("scheduleId");

    const body = await c.req.json();
    const parsed = assignCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const existing = await db.query.schedules.findFirst({
      where: and(
        eq(schedules.id, scheduleId),
        eq(schedules.tripId, tripId),
        isNull(schedules.dayPatternId),
      ),
    });
    if (!existing) {
      return c.json({ error: ERROR_MSG.CANDIDATE_NOT_FOUND }, 404);
    }

    const pattern = await db.query.dayPatterns.findFirst({
      where: eq(dayPatterns.id, parsed.data.dayPatternId),
      with: { tripDay: true },
    });
    if (!pattern || pattern.tripDay.tripId !== tripId) {
      return c.json({ error: ERROR_MSG.PATTERN_NOT_FOUND }, 404);
    }

    const nextOrder = await getNextSortOrder(
      db,
      schedules.sortOrder,
      schedules,
      eq(schedules.dayPatternId, parsed.data.dayPatternId),
    );

    const [updated] = await db
      .update(schedules)
      .set({
        dayPatternId: parsed.data.dayPatternId,
        sortOrder: nextOrder,
        updatedAt: new Date(),
      })
      .where(eq(schedules.id, scheduleId))
      .returning();

    logActivity({
      tripId,
      userId: user.id,
      action: "assigned",
      entityType: "candidate",
      entityName: updated.name,
    });

    return c.json(updated);
  },
);

export { candidateRoutes };
