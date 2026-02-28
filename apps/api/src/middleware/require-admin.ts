import type { Context, Next } from "hono";
import type { AppEnv } from "../types";

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const user = c.get("user");
  if (user.username !== adminUsername) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
}
