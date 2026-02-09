import { addMemberSchema, updateMemberRoleSchema } from "@tabi/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { tripMembers, users } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { checkTripAccess, isOwner } from "../lib/permissions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const memberRoutes = new Hono<AppEnv>();
memberRoutes.use("*", requireAuth);

// List members (any member can view)
memberRoutes.get("/:tripId/members", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!role) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const members = await db.query.tripMembers.findMany({
    where: eq(tripMembers.tripId, tripId),
    with: { user: { columns: { id: true, name: true, email: true } } },
  });

  return c.json(
    members.map((m) => ({
      userId: m.userId,
      role: m.role,
      name: m.user.name,
      email: m.user.email,
    })),
  );
});

// Add member (owner only)
memberRoutes.post("/:tripId/members", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const role = await checkTripAccess(tripId, user.id);
  if (!isOwner(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  });
  if (!targetUser) {
    return c.json({ error: "User not found" }, 404);
  }

  const existing = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUser.id)),
  });
  if (existing) {
    return c.json({ error: "Already a member" }, 409);
  }

  await db.insert(tripMembers).values({
    tripId,
    userId: targetUser.id,
    role: parsed.data.role,
  });

  return c.json(
    {
      userId: targetUser.id,
      role: parsed.data.role,
      name: targetUser.name,
      email: targetUser.email,
    },
    201,
  );
});

// Update member role (owner only)
memberRoutes.patch("/:tripId/members/:userId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const targetUserId = c.req.param("userId");

  const role = await checkTripAccess(tripId, user.id);
  if (!isOwner(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  if (targetUserId === user.id) {
    return c.json({ error: "Cannot change own role" }, 400);
  }

  const body = await c.req.json();
  const parsed = updateMemberRoleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const existing = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)),
  });
  if (!existing) {
    return c.json({ error: "Member not found" }, 404);
  }

  await db
    .update(tripMembers)
    .set({ role: parsed.data.role })
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)));

  return c.json({ ok: true });
});

// Remove member (owner only)
memberRoutes.delete("/:tripId/members/:userId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");
  const targetUserId = c.req.param("userId");

  const role = await checkTripAccess(tripId, user.id);
  if (!isOwner(role)) {
    return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
  }

  if (targetUserId === user.id) {
    return c.json({ error: "Cannot remove yourself" }, 400);
  }

  const existing = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)),
  });
  if (!existing) {
    return c.json({ error: "Member not found" }, 404);
  }

  await db
    .delete(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, targetUserId)));

  return c.json({ ok: true });
});

export { memberRoutes };
