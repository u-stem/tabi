import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { db } from "../db/index";
import { users } from "../db/schema";
import type { AppEnv } from "../types";

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const user = c.get("user");

  // user.username may be absent when the session is served from Better Auth's
  // cookieCache, which can omit plugin-added fields. Fall back to a DB lookup.
  let username = user.username;
  if (!username) {
    const row = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    username = row[0]?.username ?? null;
  }

  if (username !== adminUsername) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
}
