import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { db } from "../db/index";
import { users } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import type { AppEnv } from "../types";

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const user = c.get("user");

  // Prefer ADMIN_USER_ID (immutable) over ADMIN_USERNAME (user-changeable)
  const adminUserId = process.env.ADMIN_USER_ID;
  if (adminUserId) {
    if (user.id !== adminUserId) {
      return c.json({ error: ERROR_MSG.FORBIDDEN }, 403);
    }
    await next();
    return;
  }

  // Fallback: username-based check for backward compatibility
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) {
    return c.json({ error: ERROR_MSG.FORBIDDEN }, 403);
  }

  // Better Auth's cookieCache may omit plugin-added fields (username) from the cached
  // session. Fall back to a DB lookup when username is absent.
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
    return c.json({ error: ERROR_MSG.FORBIDDEN }, 403);
  }

  await next();
}
