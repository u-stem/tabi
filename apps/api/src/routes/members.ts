import { addMemberSchema, MAX_MEMBERS_PER_TRIP, updateMemberRoleSchema } from "@sugara/shared";
import { and, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { tripMembers, users } from "../db/schema";
import { logActivity } from "../lib/activity-logger";
import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const memberRoutes = new Hono<AppEnv>();
memberRoutes.use("*", requireAuth);

// List members (any member can view)
memberRoutes.get("/:tripId/members", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");

  const members = await db.query.tripMembers.findMany({
    where: eq(tripMembers.tripId, tripId),
    with: { user: { columns: { id: true, name: true, image: true } } },
  });

  return c.json(
    members.map((m) => ({
      userId: m.userId,
      role: m.role,
      name: m.user.name,
      image: m.user.image,
    })),
  );
});

// Add member (owner only)
memberRoutes.post("/:tripId/members", requireTripAccess("owner"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const body = await c.req.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, parsed.data.userId),
  });
  if (!targetUser) {
    return c.json({ error: ERROR_MSG.USER_NOT_FOUND }, 404);
  }

  const result = await db.transaction(async (tx) => {
    const [[{ count: memberCount }], existing] = await Promise.all([
      tx.select({ count: count() }).from(tripMembers).where(eq(tripMembers.tripId, tripId)),
      tx.query.tripMembers.findFirst({
        where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUser.id)),
      }),
    ]);
    if (memberCount >= MAX_MEMBERS_PER_TRIP) {
      return "limit" as const;
    }
    if (existing) {
      return "duplicate" as const;
    }

    await tx.insert(tripMembers).values({
      tripId,
      userId: targetUser.id,
      role: parsed.data.role,
    });

    return "ok" as const;
  });

  if (result === "limit") {
    return c.json({ error: ERROR_MSG.LIMIT_MEMBERS }, 409);
  }
  if (result === "duplicate") {
    return c.json({ error: ERROR_MSG.ALREADY_MEMBER }, 409);
  }

  logActivity({
    tripId,
    userId: user.id,
    action: "created",
    entityType: "member",
    entityName: targetUser.name,
    detail: parsed.data.role,
  });

  return c.json(
    {
      userId: targetUser.id,
      role: parsed.data.role,
      name: targetUser.name,
    },
    201,
  );
});

// Update member role (owner only)
memberRoutes.patch("/:tripId/members/:userId", requireTripAccess("owner"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const targetUserId = c.req.param("userId");

  if (targetUserId === user.id) {
    return c.json({ error: ERROR_MSG.CANNOT_CHANGE_OWN_ROLE }, 400);
  }

  const body = await c.req.json();
  const parsed = updateMemberRoleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)),
    with: { user: { columns: { name: true } } },
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.MEMBER_NOT_FOUND }, 404);
  }

  await db
    .update(tripMembers)
    .set({ role: parsed.data.role })
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)));

  logActivity({
    tripId,
    userId: user.id,
    action: "role_changed",
    entityType: "member",
    entityName: existing.user.name,
    detail: `${existing.role} → ${parsed.data.role}`,
  });

  return c.json({ ok: true });
});

// Remove member (owner only)
memberRoutes.delete("/:tripId/members/:userId", requireTripAccess("owner"), async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const targetUserId = c.req.param("userId");

  if (targetUserId === user.id) {
    return c.json({ error: ERROR_MSG.CANNOT_REMOVE_SELF }, 400);
  }

  const existing = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)),
    with: { user: { columns: { name: true } } },
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.MEMBER_NOT_FOUND }, 404);
  }

  await db
    .delete(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)));

  logActivity({
    tripId,
    userId: user.id,
    action: "deleted",
    entityType: "member",
    entityName: existing.user.name,
  });

  return c.json({ ok: true });
});

export { memberRoutes };
