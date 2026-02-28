import type { Context, Next } from "hono";
import { auth } from "../lib/auth";

export async function requireAdmin(c: Context, next: Next) {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers: c.req.raw.headers });
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const username = (session.user as { username?: string | null }).username;
  if (username !== adminUsername) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
}
