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

  // Better Auth's cookieCache may omit plugin-added fields (username) from the cached
  // session. Fall back to a DB lookup when username is absent.
  // connect_timeout: 10 in db/index.ts ensures this fails fast if the DB is unreachable.
  let username = user.username ?? null;
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
