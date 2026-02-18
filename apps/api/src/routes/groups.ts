import {
  addGroupMemberSchema,
  createGroupSchema,
  MAX_GROUPS_PER_USER,
  MAX_MEMBERS_PER_GROUP,
  updateGroupSchema,
} from "@sugara/shared";
import { and, asc, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { groupMembers, groups, users } from "../db/schema";
import { ERROR_MSG, PG_UNIQUE_VIOLATION } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const groupRoutes = new Hono<AppEnv>();
groupRoutes.use("*", requireAuth);

async function verifyGroupOwnership(groupId: string, userId: string) {
  const group = await db.query.groups.findFirst({
    where: and(eq(groups.id, groupId), eq(groups.ownerId, userId)),
  });
  return group ?? null;
}

// List owned groups with member count
groupRoutes.get("/", async (c) => {
  const user = c.get("user");

  const records = await db.query.groups.findMany({
    where: eq(groups.ownerId, user.id),
    orderBy: asc(groups.createdAt),
    with: {
      members: { columns: { userId: true } },
    },
  });

  return c.json(
    records.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.members.length,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    })),
  );
});

// Create group
groupRoutes.post("/", async (c) => {
  const user = c.get("user");

  const body = await c.req.json();
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [{ count: groupCount }] = await db
    .select({ count: count() })
    .from(groups)
    .where(eq(groups.ownerId, user.id));
  if (groupCount >= MAX_GROUPS_PER_USER) {
    return c.json({ error: ERROR_MSG.LIMIT_GROUPS }, 409);
  }

  const [created] = await db
    .insert(groups)
    .values({ ownerId: user.id, name: parsed.data.name })
    .returning({
      id: groups.id,
      name: groups.name,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
    });

  return c.json({ ...created, memberCount: 0 }, 201);
});

// Update group name
groupRoutes.patch("/:groupId", async (c) => {
  const user = c.get("user");
  const groupId = c.req.param("groupId");

  const group = await verifyGroupOwnership(groupId, user.id);
  if (!group) {
    return c.json({ error: ERROR_MSG.GROUP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(groups)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(groups.id, groupId))
    .returning({
      id: groups.id,
      name: groups.name,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
    });

  return c.json(updated);
});

// Delete group
groupRoutes.delete("/:groupId", async (c) => {
  const user = c.get("user");
  const groupId = c.req.param("groupId");

  const group = await verifyGroupOwnership(groupId, user.id);
  if (!group) {
    return c.json({ error: ERROR_MSG.GROUP_NOT_FOUND }, 404);
  }

  await db.delete(groups).where(eq(groups.id, groupId));

  return c.json({ ok: true });
});

// List group members
groupRoutes.get("/:groupId/members", async (c) => {
  const user = c.get("user");
  const groupId = c.req.param("groupId");

  const group = await db.query.groups.findFirst({
    where: and(eq(groups.id, groupId), eq(groups.ownerId, user.id)),
    with: {
      members: {
        with: {
          user: { columns: { id: true, name: true, image: true } },
        },
      },
    },
  });
  if (!group) {
    return c.json({ error: ERROR_MSG.GROUP_NOT_FOUND }, 404);
  }

  return c.json(
    group.members.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      image: m.user.image,
      addedAt: m.addedAt,
    })),
  );
});

// Add member to group
groupRoutes.post("/:groupId/members", async (c) => {
  const user = c.get("user");
  const groupId = c.req.param("groupId");

  const group = await verifyGroupOwnership(groupId, user.id);
  if (!group) {
    return c.json({ error: ERROR_MSG.GROUP_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = addGroupMemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, parsed.data.userId),
  });
  if (!targetUser) {
    return c.json({ error: ERROR_MSG.USER_NOT_FOUND }, 404);
  }

  const [{ count: memberCount }] = await db
    .select({ count: count() })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  if (memberCount >= MAX_MEMBERS_PER_GROUP) {
    return c.json({ error: ERROR_MSG.LIMIT_GROUP_MEMBERS }, 409);
  }

  try {
    await db.insert(groupMembers).values({
      groupId,
      userId: parsed.data.userId,
    });
  } catch (e) {
    if (e instanceof Error && "code" in e && e.code === PG_UNIQUE_VIOLATION) {
      return c.json({ error: ERROR_MSG.ALREADY_GROUP_MEMBER }, 409);
    }
    throw e;
  }

  return c.json({ ok: true }, 201);
});

// Remove member from group
groupRoutes.delete("/:groupId/members/:userId", async (c) => {
  const user = c.get("user");
  const groupId = c.req.param("groupId");
  const targetUserId = c.req.param("userId");

  const group = await verifyGroupOwnership(groupId, user.id);
  if (!group) {
    return c.json({ error: ERROR_MSG.GROUP_NOT_FOUND }, 404);
  }

  const existing = await db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)),
  });
  if (!existing) {
    return c.json({ error: ERROR_MSG.GROUP_MEMBER_NOT_FOUND }, 404);
  }

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)));

  return c.json({ ok: true });
});

export { groupRoutes };
