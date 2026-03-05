import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { users } from "../db/schema";

type UserLike = { id: string; username?: string | null };

/**
 * Resolve whether a user is the admin.
 * Better Auth's cookieCache may omit `username` from the cached session,
 * so we fall back to a DB lookup when it is absent.
 */
export async function resolveIsAdmin(user: UserLike): Promise<boolean> {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) return false;

  let username = user.username ?? null;
  if (!username) {
    const row = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    username = row[0]?.username ?? null;
  }

  return username === adminUsername;
}
